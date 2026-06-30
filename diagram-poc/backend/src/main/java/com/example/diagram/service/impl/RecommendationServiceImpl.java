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
import org.springframework.beans.factory.annotation.Value;
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
 * Catalogue-grounded recommendations. The AI (local Ollama, when enabled) — or a
 * keyword dictionary as a fallback — translates the design goal into concrete
 * component <em>search terms</em>. Those terms are then looked up in the live
 * Arrow part catalogue and cross-checked against Design Win POS, so the actual
 * recommended parts come from real data (stock, lifecycle, shipment history)
 * rather than the model's imagination. Template matches and a BOM nudge round
 * out the result; a generic fallback is used when nothing matches.
 */
@Service
public class RecommendationServiceImpl implements RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationServiceImpl.class);

    /** Small, focused prompt: turn a design goal into catalogue search terms. */
    private static final String TERMS_SYSTEM = """
            You convert an electronics design goal into search terms for an ELECTRONIC
            COMPONENTS catalogue (ICs, regulators, drivers, sensors, transceivers,
            connectors, passives). Rules:
            - Use 1-3 word component CATEGORY nouns only, e.g. "motor driver",
              "buck regulator", "IMU sensor", "CAN transceiver", "microcontroller",
              "gate driver", "current sense amplifier".
            - NO adjectives like fast/powerful/high-speed/lightweight.
            - NO mechanical or structural parts (chassis, gears, motors, frames, wheels).
            - Do NOT invent part numbers.
            Return ONLY minified JSON of the form {"terms":["term1","term2"]} with 3-6 terms.
            """;

    private final OllamaProperties props;
    private final TemplateRepository templates;
    private final PartSearchService parts;
    private final DesignWinService designWin;
    private final ComponentKeywordDictionary keywords;
    private final ObjectMapper mapper;
    private final RestClient rest;

    /**
     * Whether to cross-check Design Win POS for "field-proven" status. Worth
     * disabling where POS data isn't loaded (e.g. DEV returns an empty envelope),
     * to avoid a wasted call per recommended part. Defaults to true.
     */
    @Value("${recommendation.pos-check:true}")
    private boolean posCheck = true;

    public RecommendationServiceImpl(OllamaProperties props, TemplateRepository templates,
                                     PartSearchService parts, DesignWinService designWin,
                                     ComponentKeywordDictionary keywords, ObjectMapper mapper) {
        this.props = props;
        this.templates = templates;
        this.parts = parts;
        this.designWin = designWin;
        this.keywords = keywords;
        this.mapper = mapper;
        this.rest = RestClient.create();
    }

    /** Max catalogue searches per recommendation (keeps latency bounded). */
    private static final int MAX_TERMS = 4;

    @Override
    public RecommendationResult recommend(RecommendationRequest request) {
        RecommendationRequest req = normalize(request);

        // Canvas parts + the reliable, catalogue-friendly dictionary first.
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        for (String p : req.currentParts()) {
            if (present(p)) terms.add(p.trim());
        }
        terms.addAll(keywords.termsFor(req.goal()));

        // Only spend the (slow) local model when the dictionary is thin, so the
        // common case stays fast. The model just proposes more search terms.
        boolean usedAi = false;
        if (props.isConfigured() && terms.size() < 3) {
            List<String> ai = aiSearchTerms(req.goal());
            terms.addAll(ai);
            usedAi = !ai.isEmpty();
        }

        List<String> termList = terms.stream().limit(MAX_TERMS).collect(Collectors.toList());
        log.info("Recommendation search terms for goal '{}': {}", req.goal(), termList);

        // The catalogue + Design Win APIs are the source of truth for actual parts.
        List<RecommendationItem> partItems = catalogueItems(termList);

        List<RecommendationItem> items = new ArrayList<>();
        if (!partItems.isEmpty()) {
            items.addAll(partItems);
        } else {
            items.addAll(fallbackParts(req.goal())); // generic suggestions when nothing matched
        }
        items.addAll(templateItems(req));
        items.add(bomNudge());
        items = dedupeByTitle(items);

        boolean grounded = !partItems.isEmpty();
        String model = grounded ? (usedAi ? "Local AI (" + props.getModel() + ") + catalogue" : "Arrow catalogue")
                : "rule-based";
        String note = grounded
                ? "Grounded in the live Arrow catalogue (stock, lifecycle, POS)."
                : (props.isConfigured() ? "No live catalogue matches — showing general guidance." : null);
        return new RecommendationResult(items, model, grounded, note);
    }

    /** Ask the local model for component search terms (small, reliable prompt). */
    private List<String> aiSearchTerms(String goal) {
        if (goal.isBlank()) return List.of();
        try {
            String user = "Design goal: " + goal;
            Map<String, Object> body = Map.of(
                    "model", props.getModel(),
                    "max_tokens", 200,
                    "stream", false,
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of("role", "system", "content", TERMS_SYSTEM),
                            Map.of("role", "user", "content", user)));

            log.info("→ Ollama {} (search terms) @ {}\n[user]\n{}",
                    props.getModel(), props.getBaseUrl() + "/v1/chat/completions", user);
            long started = System.currentTimeMillis();

            JsonNode resp = rest.post()
                    .uri(props.getBaseUrl() + "/v1/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            String text = resp == null ? "" : resp.at("/choices/0/message/content").asText("");
            log.info("← Ollama {} (search terms, {} ms): {}",
                    props.getModel(), System.currentTimeMillis() - started, text);

            JsonNode root = mapper.readTree(extractJsonObject(text));
            List<String> out = new ArrayList<>();
            for (JsonNode n : root.path("terms")) {
                String s = n.asText("").trim();
                if (!s.isBlank()) out.add(s);
            }
            return out;
        } catch (Exception ex) {
            log.warn("AI search-term extraction failed ({}); using keyword dictionary.", ex.toString());
            return List.of();
        }
    }

    // ---- Live catalogue grounding ----

    /** Look each term up in the catalogue (in parallel); return de-duplicated grounded parts. */
    private List<RecommendationItem> catalogueItems(List<String> terms) {
        // Run the per-term lookups concurrently — they're independent network calls.
        List<RecommendationItem> found = terms.parallelStream()
                .map(this::lookupCatalogue)
                .filter(i -> i != null)
                .collect(Collectors.toList());

        Map<String, RecommendationItem> byPart = new LinkedHashMap<>();
        for (RecommendationItem i : found) {
            byPart.putIfAbsent(i.title().toLowerCase(), i);
        }
        return new ArrayList<>(byPart.values());
    }

    /** Search the catalogue for one term and turn the BEST hit into a grounded item. */
    private RecommendationItem lookupCatalogue(String term) {
        try {
            String json = parts.search(term, null, false);
            JsonNode arr = mapper.readTree(json == null ? "" : json).at("/partserviceresult/parts");
            if (!arr.isArray() || arr.isEmpty()) return null;

            // Prefer an Active, in-stock part over the (arbitrary) first result.
            JsonNode best = null;
            int bestScore = Integer.MIN_VALUE;
            for (JsonNode p : arr) {
                int s = partScore(p);
                if (s > bestScore) {
                    bestScore = s;
                    best = p;
                }
            }
            if (best == null) return null;

            String pn = firstText(best.at("/arwPartNum/name"), best.at("/suppPartNum/name"), term);
            String supplier = firstText(best.at("/mfr/name"), best.at("/supp/name"), "");
            JsonNode org = best.at("/invOrgs/0");
            String status = org.at("/status").asText("");
            long stock = stockOf(best);
            String lead = best.at("/leadTime/arwLT").asText("");
            String desc = firstText(org.at("/desc"), best.at("/icc/name"), pn);

            // Cross-check Design Win POS: a part with shipment history is field-proven.
            boolean proven = hasPosSales(pn, supplier);

            String detail = "Matched \"" + term + "\" — " + desc
                    + " · " + (status.isBlank() ? "status n/a" : status)
                    + ", " + stock + " in stock"
                    + (lead.isBlank() ? "" : ", lead " + lead + " wks")
                    + (proven ? " · field-proven (POS shipment history)" : "");
            String source = "Arrow catalogue (live)" + (supplier.isBlank() ? "" : " · " + supplier);
            String verify = stock > 0
                    ? "In stock now — confirm the lifecycle status and specs before committing."
                    : "Best match is out of stock — check lead time or pick an in-stock alternative.";
            return new RecommendationItem("part", pn, detail, source, verify);
        } catch (Exception ex) {
            log.debug("Catalogue lookup for '{}' failed: {}", term, ex.toString());
            return null;
        }
    }

    /** Rank a catalogue part: in-stock and an active lifecycle status score highest. */
    private int partScore(JsonNode part) {
        String status = part.at("/invOrgs/0/status").asText("").toLowerCase();
        // "Nvr.Active" / "Never Active" are dead statuses despite containing "active".
        boolean dead = status.contains("nvr") || status.contains("never")
                || status.contains("obsolete") || status.contains("eol");
        boolean active = !dead && (status.contains("active") || status.contains("new"));
        int s = 0;
        if (stockOf(part) > 0) s += 3;
        if (active) s += 2;
        return s;
    }

    private long stockOf(JsonNode part) {
        JsonNode avail = part.at("/invOrgs/0/avail");
        return avail.at("/totohQty").asLong(avail.at("/FOHQty").asLong(avail.at("/ACFOHQty").asLong(0)));
    }

    /** True when the Design Win POS API reports shipment history for the part. */
    private boolean hasPosSales(String partNumber, String mfr) {
        if (!posCheck) return false; // POS disabled (e.g. no POS data in this environment)
        try {
            String json = designWin.sales(partNumber, present(mfr) ? mfr : null);
            JsonNode root = mapper.readTree(json == null ? "" : json);
            // POS records may be wrapped under different keys across environments; a
            // non-empty records array (or a positive posAmount) means shipment history.
            for (String key : new String[]{"sales", "details", "pos", "salesData", "posData"}) {
                JsonNode arr = root.path(key);
                if (arr.isArray() && !arr.isEmpty()) return true;
            }
            return root.path("posAmount").asDouble(0) > 0;
        } catch (Exception ex) {
            log.debug("POS lookup for '{}' failed: {}", partNumber, ex.toString());
            return false;
        }
    }

    // ---- Templates, fallback parts, nudge ----

    /** Top template matches for the goal (by keyword overlap). */
    private List<RecommendationItem> templateItems(RecommendationRequest req) {
        String g = (req.goal() + " " + String.join(" ", req.currentParts())).toLowerCase();
        List<RecommendationItem> out = new ArrayList<>();
        templates.findAll().stream()
                .map(t -> Map.entry(t, score(t, g)))
                .filter(e -> e.getValue() > 0)
                .sorted((a, b) -> b.getValue() - a.getValue())
                .limit(2)
                .forEach(e -> {
                    Template t = e.getKey();
                    out.add(new RecommendationItem("template", t.getName(),
                            t.getDescription() == null ? "A reusable starting point." : t.getDescription(),
                            "Template repository", "Open it and confirm the blocks match your architecture."));
                });
        return out;
    }

    /** Generic catalogue suggestions when no live match was found, by keyword. */
    private List<RecommendationItem> fallbackParts(String goal) {
        String g = goal.toLowerCase();
        List<RecommendationItem> items = new ArrayList<>();
        if (anyOf(g, "power", "supply", "regulat", "battery", "buck", "boost", "ldo")) {
            items.add(part("LM317T", "Adjustable LDO regulator (STMicroelectronics)",
                    "Verify input/output voltage headroom and thermal dissipation for your load."));
        }
        if (anyOf(g, "wifi", "wireless", "ble", "mcu", "iot")) {
            items.add(part("ESP32-WROOM-32", "Wi-Fi/BLE MCU module (Espressif)",
                    "Confirm 3.3V rail current capability and antenna keep-out on your PCB."));
        }
        if (anyOf(g, "current", "sense", "amplif", "metering")) {
            items.add(part("INA250A3PWR", "Current-sense amplifier (Texas Instruments)",
                    "Verify the integrated shunt value and common-mode range for your bus."));
        }
        if (anyOf(g, "robot", "amr", "motor", "servo", "drive")) {
            items.add(part("DRV8870", "Brushed DC motor driver, 3.6A (Texas Instruments)",
                    "Check the peak/continuous current and thermal pad layout for your motor."));
        }
        return items;
    }

    private RecommendationItem bomNudge() {
        return new RecommendationItem("solution", "Add a Bill of Materials check",
                "Drop your parts onto the canvas and export a BOM to catch duplicates and quantities early.",
                "Tool best-practice", "Cross-check each part's lifecycle status before release.");
    }

    // ---- helpers ----

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

    private List<RecommendationItem> dedupeByTitle(List<RecommendationItem> in) {
        Map<String, RecommendationItem> byTitle = new LinkedHashMap<>();
        for (RecommendationItem i : in) byTitle.putIfAbsent(i.title().toLowerCase(), i);
        return new ArrayList<>(byTitle.values());
    }

    private static boolean anyOf(String hay, String... keys) {
        for (String k : keys) {
            if (hay.contains(k)) return true;
        }
        return false;
    }

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }

    private static String firstText(JsonNode a, JsonNode b, String fallback) {
        if (a != null && a.isTextual() && !a.asText().isBlank()) return a.asText();
        if (b != null && b.isTextual() && !b.asText().isBlank()) return b.asText();
        return fallback;
    }

    /** Extract the first JSON object substring (tolerating prose/fences around it). */
    private static String extractJsonObject(String text) {
        if (text == null) return "{}";
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        return (start >= 0 && end > start) ? text.substring(start, end + 1) : "{}";
    }

    private RecommendationRequest normalize(RecommendationRequest req) {
        String goal = req == null || req.goal() == null ? "" : req.goal().trim();
        List<String> parts = req == null || req.currentParts() == null ? List.of() : req.currentParts();
        return new RecommendationRequest(goal, parts);
    }
}
