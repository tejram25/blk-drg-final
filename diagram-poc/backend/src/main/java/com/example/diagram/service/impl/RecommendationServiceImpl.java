package com.example.diagram.service.impl;

import com.example.diagram.config.OpenAiProperties;
import com.example.diagram.domain.Template;
import com.example.diagram.repository.TemplateRepository;
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
import java.util.List;
import java.util.Map;

/**
 * Recommendations backed by OpenAI (ChatGPT) when {@code openai.api-key} is set,
 * with a deterministic rule-based fallback otherwise (and on any upstream
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

    private final OpenAiProperties props;
    private final TemplateRepository templates;
    private final ObjectMapper mapper;
    private final RestClient rest;

    public RecommendationServiceImpl(OpenAiProperties props, TemplateRepository templates, ObjectMapper mapper) {
        this.props = props;
        this.templates = templates;
        this.mapper = mapper;
        this.rest = RestClient.create();
    }

    @Override
    public RecommendationResult recommend(RecommendationRequest request) {
        RecommendationRequest req = normalize(request);
        if (props.isConfigured()) {
            try {
                return askOpenAi(req);
            } catch (Exception ex) {
                log.warn("OpenAI recommendation failed ({}); falling back to rule-based.", ex.toString());
                RecommendationResult rb = ruleBased(req);
                return new RecommendationResult(rb.items(), rb.model(), false,
                        "AI was unavailable — showing rule-based suggestions.");
            }
        }
        return ruleBased(req);
    }

    // ---- OpenAI (ChatGPT) path ----

    private RecommendationResult askOpenAi(RecommendationRequest req) throws Exception {
        String user = "Design goal: " + (req.goal().isBlank() ? "(unspecified)" : req.goal())
                + "\nParts already on the canvas: "
                + (req.currentParts().isEmpty() ? "(none)" : String.join(", ", req.currentParts()))
                + "\nAvailable templates: " + templateNames();

        Map<String, Object> body = Map.of(
                "model", props.getModel(),
                "max_tokens", props.getMaxTokens(),
                // Force a JSON object response so parsing is reliable.
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM),
                        Map.of("role", "user", "content", user)));

        JsonNode resp = rest.post()
                .uri(props.getBaseUrl() + "/v1/chat/completions")
                .header("Authorization", "Bearer " + props.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        String text = resp == null ? "" : resp.at("/choices/0/message/content").asText("");
        List<RecommendationItem> items = parseItems(text);
        if (items.isEmpty()) {
            return ruleBased(req); // model returned nothing parseable
        }
        return new RecommendationResult(items, props.getModel(), true, null);
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
                        n.path("source").asText("ChatGPT — verify"),
                        n.path("verify").asText("Check the datasheet before committing.")));
            }
        } catch (Exception ex) {
            log.warn("Could not parse OpenAI JSON: {}", ex.toString());
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
