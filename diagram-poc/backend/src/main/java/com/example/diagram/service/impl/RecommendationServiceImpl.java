package com.example.diagram.service.impl;

import com.example.diagram.config.OllamaProperties;
import com.example.diagram.domain.Template;
import com.example.diagram.repository.TemplateRepository;
import com.example.diagram.service.DesignWinService;
import com.example.diagram.service.PartSearchService;
import com.example.diagram.service.RecommendationService;
import com.example.diagram.web.dto.RecommendationItem;
import com.example.diagram.web.dto.RecommendationRequest;
import com.example.diagram.web.dto.RecommendationResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Recommendations backed by a local Ollama model when {@code ollama.enabled} is
 * true, with a deterministic rule-based fallback otherwise (and on any upstream
 * failure), so the feature always returns useful, source-traceable suggestions.
 */
@Service
public class RecommendationServiceImpl implements RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationServiceImpl.class);

    private static final String SYSTEM = """
            You are an electronics design assistant inside a block-diagram tool.
            Recommend reusable templates, catalogue parts, and solution options for the
            user's design. Be concrete and conservative: only suggest drop-in or
            widely-available parts. For EVERY item include a short "verify" prompt telling
            the engineer exactly what to check on the datasheet/specs before committing.
            Respond with ONLY minified JSON, no prose, of the form:
            {"items":[{"type":"template|part|solution","title":"...","detail":"...","source":"...","verify":"..."}]}
            Keep to at most 6 items. "source" must state where the suggestion comes from.
            """;

    private final OllamaProperties props;
    private final TemplateRepository templates;
    private final PartSearchService parts;
    private final DesignWinService designWin;
    private final ObjectMapper mapper;
    private final RestClient rest;

    public RecommendationServiceImpl(OllamaProperties props, TemplateRepository templates,
                                     PartSearchService parts, DesignWinService designWin,
                                     ObjectMapper mapper) {
        this.props = props;
        this.templates = templates;
        this.parts = parts;
        this.designWin = designWin;
        this.mapper = mapper;
        this.rest = RestClient.create();
    }

    @Override
    public RecommendationResult recommend(RecommendationRequest request) {
        RecommendationRequest req = normalize(request);
        // Ground the recommendation in live catalogue availability (best-effort).
        List<RecommendationItem> catalogue = catalogueItems(req);

        if (props.isConfigured()) {
            try {
                return askOllama(req, catalogue);
            } catch (Exception ex) {
                log.warn("Ollama recommendation failed ({}); falling back to rule-based.", ex.toString());
                String note = "AI was unavailable — showing rule-based suggestions"
                        + (catalogue.isEmpty() ? "." : " with live catalogue data.");
                return new RecommendationResult(
                        combine(catalogue, ruleBased(req).items()), "rule-based", false, note);
            }
        }
        String note = catalogue.isEmpty() ? null : "Includes live Arrow catalogue availability.";
        return new RecommendationResult(
                combine(catalogue, ruleBased(req).items()), "rule-based", false, note);
    }

    // ---- Live catalogue grounding ----

    /**
     * Look up real, current parts for the design (the parts already on the canvas
     * plus keyword-derived canonical parts), so recommendations reflect actual
     * stock and lifecycle status. Best-effort: any upstream failure yields fewer
     * (or no) catalogue items, and the rest of the recommendation still works.
     */
    private List<RecommendationItem> catalogueItems(RecommendationRequest req) {
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        for (String p : req.currentParts()) {
            if (p != null && !p.isBlank()) terms.add(p.trim());
        }
        terms.addAll(keywordParts(req.goal()));

        List<RecommendationItem> out = new ArrayList<>();
        for (String term : terms) {
            if (out.size() >= 5) break;
            RecommendationItem item = lookupCatalogue(term);
            if (item != null) out.add(item);
        }
        return out;
    }

    /** Search the catalogue for one term and turn the best hit into a grounded item. */
    private RecommendationItem lookupCatalogue(String term) {
        try {
            String json = parts.search(term, null, false);
            JsonNode part = mapper.readTree(json == null ? "" : json).at("/partserviceresult/parts/0");
            if (part.isMissingNode() || part.isNull()) return null;

            String pn = firstText(part.at("/arwPartNum/name"), part.at("/suppPartNum/name"), term);
            String supplier = firstText(part.at("/mfr/name"), part.at("/supp/name"), "");
            JsonNode org = part.at("/invOrgs/0");
            String status = org.at("/status").asText("");
            long stock = org.at("/avail/totohQty").asLong(org.at("/avail/FOHQty").asLong(0));
            String lead = part.at("/leadTime/arwLT").asText("");
            String desc = firstText(org.at("/desc"), part.at("/icc/name"), pn);

            // Cross-check Design Win POS: a part with shipment history is field-proven.
            boolean proven = hasPosSales(pn, supplier);

            String detail = desc
                    + " — " + (status.isBlank() ? "status n/a" : status)
                    + ", " + stock + " in stock"
                    + (lead.isBlank() ? "" : ", lead " + lead + " wks")
                    + (proven ? " · field-proven (POS shipment history)" : "");
            String source = "Arrow catalogue (live)" + (supplier.isBlank() ? "" : " · " + supplier);
            String verify = stock > 0
                    ? "In stock now — confirm the lifecycle status and specs before committing."
                    : "Out of stock — check lead time and consider an alternative before committing.";
            return new RecommendationItem("part", pn, detail, source, verify);
        } catch (Exception ex) {
            log.debug("Catalogue lookup for '{}' failed: {}", term, ex.toString());
            return null;
        }
    }

    /** True when the Design Win POS API reports shipment history for the part. */
    private boolean hasPosSales(String partNumber, String mfr) {
        try {
            String json = designWin.sales(partNumber, mfr == null || mfr.isBlank() ? null : mfr);
            JsonNode sales = mapper.readTree(json == null ? "" : json).path("sales");
            return sales.isArray() && sales.size() > 0;
        } catch (Exception ex) {
            log.debug("POS lookup for '{}' failed: {}", partNumber, ex.toString());
            return false;
        }
    }

    /** Canonical part numbers implied by the design goal, used as catalogue search terms. */
    private List<String> keywordParts(String goal) {
        String g = (goal == null ? "" : goal).toLowerCase();
        List<String> out = new ArrayList<>();
        if (g.contains("power") || g.contains("regulat") || g.contains("supply")) out.add("LM317T");
        if (g.contains("wifi") || g.contains("wireless") || g.contains("ble") || g.contains("mcu")) out.add("ESP32-WROOM-32");
        if (g.contains("current") || g.contains("sense") || g.contains("amplif")) out.add("INA250A3PWR");
        if (g.contains("decoupl") || g.contains("capacit") || g.contains("filter")) out.add("GRM188R71H104KA93D");
        return out;
    }

    /** Merge two item lists, de-duplicated by title (case-insensitive); first wins. */
    private List<RecommendationItem> combine(List<RecommendationItem> first, List<RecommendationItem> second) {
        Map<String, RecommendationItem> byTitle = new LinkedHashMap<>();
        for (RecommendationItem i : first) byTitle.putIfAbsent(i.title().toLowerCase(), i);
        for (RecommendationItem i : second) byTitle.putIfAbsent(i.title().toLowerCase(), i);
        return new ArrayList<>(byTitle.values());
    }

    /** First non-blank textual node, else the fallback string. */
    private static String firstText(JsonNode a, JsonNode b, String fallback) {
        if (a != null && a.isTextual() && !a.asText().isBlank()) return a.asText();
        if (b != null && b.isTextual() && !b.asText().isBlank()) return b.asText();
        return fallback;
    }

    // ---- Local Ollama path (OpenAI-compatible endpoint) ----

    private RecommendationResult askOllama(RecommendationRequest req,
                                           List<RecommendationItem> catalogue) throws Exception {
        String availability = catalogue.isEmpty()
                ? "(none retrieved)"
                : catalogue.stream()
                        .map(i -> "- " + i.title() + ": " + i.detail())
                        .collect(Collectors.joining("\n"));

        String user = "Design goal: " + (req.goal().isBlank() ? "(unspecified)" : req.goal())
                + "\nParts already on the canvas: "
                + (req.currentParts().isEmpty() ? "(none)" : String.join(", ", req.currentParts()))
                + "\nAvailable templates: " + templateNames()
                + "\nLive Arrow catalogue availability (prefer parts that are Active and in stock; "
                + "when you recommend one of these, cite its real status/stock as the source):\n"
                + availability;

        Map<String, Object> body = Map.of(
                "model", props.getModel(),
                "max_tokens", props.getMaxTokens(),
                "stream", false,
                // Ask for a JSON object response so parsing is reliable.
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM),
                        Map.of("role", "user", "content", user)));

        log.info("→ Ollama {} @ {}\n[system]\n{}\n[user]\n{}",
                props.getModel(), props.getBaseUrl() + "/v1/chat/completions", SYSTEM, user);
        long started = System.currentTimeMillis();

        JsonNode resp = rest.post()
                .uri(props.getBaseUrl() + "/v1/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        String text = resp == null ? "" : resp.at("/choices/0/message/content").asText("");
        log.info("← Ollama {} ({} ms) response:\n{}",
                props.getModel(), System.currentTimeMillis() - started, text);
        List<RecommendationItem> items = parseItems(text);
        if (items.isEmpty()) {
            // Model returned nothing parseable — still surface live catalogue data.
            return new RecommendationResult(combine(catalogue, ruleBased(req).items()),
                    "rule-based", false,
                    catalogue.isEmpty() ? null : "Includes live Arrow catalogue availability.");
        }
        // Keep the model's reasoning but make sure the live, grounded parts are present.
        String note = catalogue.isEmpty() ? null : "Grounded in live Arrow catalogue availability.";
        return new RecommendationResult(combine(items, catalogue), props.getModel(), true, note);
    }

    /** Pull the items array out of the model's JSON (tolerating ```json fences). */
    private List<RecommendationItem> parseItems(String text) {
        String json = text.trim();
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start < 0 || end <= start) return List.of();
        json = json.substring(start, end + 1);
        List<RecommendationItem> out = new ArrayList<>();
        try {
            JsonNode root = mapper.readTree(json);
            for (JsonNode n : root.path("items")) {
                out.add(new RecommendationItem(
                        n.path("type").asText("solution"),
                        n.path("title").asText(""),
                        n.path("detail").asText(""),
                        n.path("source").asText("Local AI (Ollama) — verify"),
                        n.path("verify").asText("Check the datasheet before committing.")));
            }
        } catch (Exception ex) {
            log.warn("Could not parse Ollama JSON: {}", ex.toString());
        }
        return out;
    }

    // ---- Rule-based fallback ----

    RecommendationResult ruleBased(RecommendationRequest req) {
        String g = (req.goal() + " " + String.join(" ", req.currentParts())).toLowerCase();
        List<RecommendationItem> items = new ArrayList<>();

        // Templates: rank by keyword overlap with the goal.
        templates.findAll().stream()
                .map(t -> Map.entry(t, score(t, g)))
                .filter(e -> e.getValue() > 0)
                .sorted((a, b) -> b.getValue() - a.getValue())
                .limit(2)
                .forEach(e -> {
                    Template t = e.getKey();
                    items.add(new RecommendationItem("template", t.getName(),
                            t.getDescription() == null ? "A reusable starting point." : t.getDescription(),
                            "Template repository", "Open it and confirm the blocks match your architecture."));
                });

        // Parts: keyword-triggered catalogue suggestions.
        if (g.contains("power") || g.contains("regulat") || g.contains("supply")) {
            items.add(part("LM317T", "Adjustable LDO regulator (STMicroelectronics)",
                    "Verify input/output voltage headroom and thermal dissipation for your load."));
        }
        if (g.contains("wifi") || g.contains("wireless") || g.contains("ble") || g.contains("mcu")) {
            items.add(part("ESP32-WROOM-32", "Wi-Fi/BLE MCU module (Espressif)",
                    "Confirm 3.3V rail current capability and antenna keep-out on your PCB."));
        }
        if (g.contains("current") || g.contains("sense") || g.contains("amplif")) {
            items.add(part("INA250A3PWR", "Current-sense amplifier (Texas Instruments)",
                    "Verify the integrated shunt value and common-mode range for your bus."));
        }
        if (g.contains("decoupl") || g.contains("capacit") || g.contains("filter")) {
            items.add(part("GRM188R71H104KA93D", "0.1µF MLCC decoupling capacitor (Murata)",
                    "Check voltage derating (X7R) at your rail voltage."));
        }

        // Always include one solution-level nudge.
        items.add(new RecommendationItem("solution", "Add a Bill of Materials check",
                "Drop your parts onto the canvas and export a BOM to catch duplicates and quantities early.",
                "Tool best-practice", "Cross-check each part's lifecycle status before release."));

        return new RecommendationResult(items, "rule-based", false, null);
    }

    private RecommendationItem part(String pn, String detail, String verify) {
        return new RecommendationItem("part", pn, detail, "Arrow catalogue", verify);
    }

    private int score(Template t, String goal) {
        String hay = (t.getName() + " " + (t.getCategory() == null ? "" : t.getCategory()) + " "
                + (t.getDescription() == null ? "" : t.getDescription())).toLowerCase();
        int s = 0;
        for (String w : goal.split("\\s+")) {
            if (w.length() >= 4 && hay.contains(w)) s++;
        }
        return s;
    }

    private String templateNames() {
        return templates.findAll().stream().map(Template::getName).limit(20)
                .reduce((a, b) -> a + ", " + b).orElse("(none)");
    }

    private RecommendationRequest normalize(RecommendationRequest req) {
        String goal = req == null || req.goal() == null ? "" : req.goal().trim();
        List<String> parts = req == null || req.currentParts() == null ? List.of() : req.currentParts();
        return new RecommendationRequest(goal, parts);
    }
}
