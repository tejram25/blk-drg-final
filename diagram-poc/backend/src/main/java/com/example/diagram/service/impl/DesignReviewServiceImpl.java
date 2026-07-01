package com.example.diagram.service.impl;

import com.example.diagram.config.OllamaProperties;
import com.example.diagram.service.DesignReviewService;
import com.example.diagram.web.dto.DesignReviewRequest;
import com.example.diagram.web.dto.DesignReviewResult;
import com.example.diagram.web.dto.ReviewFinding;
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
import java.util.Set;

/**
 * AI design review of a block diagram. Deterministic heuristics always run
 * (isolated blocks, missing power/decoupling/protection/driver, etc.); when the
 * local model is enabled its findings are merged in on top. Best-effort — a
 * model failure falls back to the heuristics alone.
 */
@Service
public class DesignReviewServiceImpl implements DesignReviewService {

    private static final Logger log = LoggerFactory.getLogger(DesignReviewServiceImpl.class);

    private static final String SYSTEM = """
            You are a senior electronics hardware design reviewer. Given a block diagram
            (functional blocks and the connections between them), point out architectural
            gaps, missing supporting components, and risks — e.g. missing power/decoupling,
            no ESD/overcurrent protection on external interfaces, a motor without a driver,
            no clock for an MCU, unconnected blocks. Be specific and practical; do NOT
            invent part numbers. Respond with ONLY minified JSON of the form
            {"findings":[{"severity":"risk|warn|info","category":"...","title":"...","detail":"...","suggestion":"..."}]}
            with at most 8 findings.
            """;

    private final OllamaProperties props;
    private final ObjectMapper mapper;
    private final RestClient rest;

    public DesignReviewServiceImpl(OllamaProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.rest = RestClient.create();
    }

    @Override
    public DesignReviewResult review(DesignReviewRequest request) {
        DesignReviewRequest req = normalize(request);

        List<ReviewFinding> heuristics = heuristicFindings(req);

        if (props.isConfigured()) {
            try {
                List<ReviewFinding> ai = askOllama(req);
                if (!ai.isEmpty()) {
                    List<ReviewFinding> merged = dedupe(ai, heuristics);
                    return new DesignReviewResult(sort(merged), props.getModel(), true,
                            "Reviewed by " + props.getModel() + " with rule checks.");
                }
            } catch (Exception ex) {
                log.warn("Ollama design review failed ({}); using heuristics.", ex.toString());
            }
        }
        String note = heuristics.isEmpty()
                ? "No issues found by the built-in checks."
                : "Built-in design checks (enable Ollama for a deeper review).";
        return new DesignReviewResult(sort(heuristics), "rule-based", false, note);
    }

    // ---- Ollama path ----

    private List<ReviewFinding> askOllama(DesignReviewRequest req) throws Exception {
        StringBuilder user = new StringBuilder();
        user.append("Design goal: ").append(req.goal().isBlank() ? "(unspecified)" : req.goal()).append('\n');
        user.append("Blocks:\n");
        for (DesignReviewRequest.Block b : req.blocks()) {
            user.append("- ").append(b.name());
            if (b.type() != null && !b.type().isBlank()) user.append(" (").append(b.type()).append(')');
            user.append('\n');
        }
        user.append("Connections:\n");
        if (req.links().isEmpty()) {
            user.append("(none)\n");
        } else {
            for (DesignReviewRequest.Link l : req.links()) {
                user.append("- ").append(l.from()).append(" -> ").append(l.to()).append('\n');
            }
        }

        Map<String, Object> body = Map.of(
                "model", props.getModel(),
                "max_tokens", props.getMaxTokens(),
                "stream", false,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM),
                        Map.of("role", "user", "content", user.toString())));

        log.info("→ Ollama {} (design review) @ {}\n[user]\n{}",
                props.getModel(), props.getBaseUrl() + "/v1/chat/completions", user);
        long started = System.currentTimeMillis();

        JsonNode resp = rest.post()
                .uri(props.getBaseUrl() + "/v1/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        String text = resp == null ? "" : resp.at("/choices/0/message/content").asText("");
        log.info("← Ollama {} (design review, {} ms):\n{}",
                props.getModel(), System.currentTimeMillis() - started, text);
        return parseFindings(text);
    }

    private List<ReviewFinding> parseFindings(String text) {
        List<ReviewFinding> out = new ArrayList<>();
        String json = extractJsonObject(text);
        try {
            JsonNode root = mapper.readTree(json);
            for (JsonNode n : root.path("findings")) {
                out.add(new ReviewFinding(
                        normSeverity(n.path("severity").asText("info")),
                        n.path("category").asText("General"),
                        n.path("title").asText(""),
                        n.path("detail").asText(""),
                        n.path("suggestion").asText("")));
            }
        } catch (Exception ex) {
            log.warn("Could not parse Ollama review JSON: {}", ex.toString());
        }
        out.removeIf(f -> f.title().isBlank());
        return out;
    }

    // ---- Heuristics ----

    private List<ReviewFinding> heuristicFindings(DesignReviewRequest req) {
        List<ReviewFinding> out = new ArrayList<>();
        String all = req.blocks().stream().map(b -> b.name() + " " + (b.type() == null ? "" : b.type()))
                .reduce("", (a, b) -> a + " " + b).toLowerCase();

        boolean hasPower = any(all, "power", "supply", "regulat", "ldo", "dcdc", "buck", "boost", "pmic", "battery");
        boolean hasMcu = any(all, "mcu", "microcontroller", "processor", "controller", "fpga", "soc", "compute", "cpu");
        boolean hasDecoupling = any(all, "decoupl", "capacit", "bypass");
        boolean hasProtection = any(all, "protection", "tvs", "esd", "fuse", "surge", "clamp", "varistor");
        boolean hasUsb = any(all, "usb", "type-c", "typec");
        boolean hasMotor = any(all, "motor", "servo", "bldc", "actuator");
        boolean hasDriver = any(all, "driver", "gate");
        boolean hasClock = any(all, "clock", "oscillator", "crystal", "rtc");
        boolean hasSensor = any(all, "sensor", "imu", "accel", "temperature", "pressure", "gyro");
        boolean hasExternalIo = hasUsb || any(all, "connector", "ethernet", "rs485", "can", "antenna", "rf", "input");

        if (!req.blocks().isEmpty() && !hasPower) {
            out.add(f("risk", "Power", "No power supply block",
                    "The diagram has no power/regulator block, so the supply rails aren't represented.",
                    "Add a power supply / voltage-regulator block and connect it to the loads."));
        }
        if (hasMcu && !hasDecoupling) {
            out.add(f("warn", "Power integrity", "No decoupling near the controller",
                    "A microcontroller/processor is present but there's no decoupling/bypass capacitor block.",
                    "Add decoupling capacitors on each supply pin of the MCU/processor."));
        }
        if (hasMcu && !hasClock) {
            out.add(f("info", "Timing", "No explicit clock source",
                    "No crystal/oscillator block is shown for the controller.",
                    "Confirm the MCU uses its internal oscillator, or add an external crystal for timing accuracy."));
        }
        if (hasExternalIo && !hasProtection) {
            out.add(f(hasUsb ? "risk" : "warn", "Protection", "External interface without protection",
                    "There are external interfaces but no ESD/overcurrent protection block.",
                    "Add TVS/ESD protection (and a fuse where appropriate) on external-facing connectors."));
        }
        if (hasMotor && !hasDriver) {
            out.add(f("risk", "Drive", "Motor without a driver",
                    "A motor/actuator is present but no motor-driver or gate-driver block feeds it.",
                    "Add a motor-driver / gate-driver stage between the controller and the motor."));
        }
        if (hasSensor && !hasMcu) {
            out.add(f("info", "Architecture", "Sensors with no controller",
                    "Sensor blocks are present but there's no controller to read them.",
                    "Add a microcontroller (or connect the sensors to an existing one)."));
        }

        // Structural: blocks with no connections at all.
        Set<String> connected = new LinkedHashSet<>();
        for (DesignReviewRequest.Link l : req.links()) {
            if (l.from() != null) connected.add(l.from().trim().toLowerCase());
            if (l.to() != null) connected.add(l.to().trim().toLowerCase());
        }
        if (!req.links().isEmpty()) {
            for (DesignReviewRequest.Block b : req.blocks()) {
                if (b.name() != null && !connected.contains(b.name().trim().toLowerCase())) {
                    out.add(f("info", "Connectivity", "Unconnected block: " + b.name(),
                            "\"" + b.name() + "\" isn't wired to anything in the diagram.",
                            "Connect it to the rest of the design, or remove it if it's a note."));
                }
            }
        }
        return out;
    }

    // ---- helpers ----

    private List<ReviewFinding> dedupe(List<ReviewFinding> primary, List<ReviewFinding> extra) {
        Map<String, ReviewFinding> byTitle = new LinkedHashMap<>();
        for (ReviewFinding f : primary) byTitle.putIfAbsent(f.title().toLowerCase(), f);
        for (ReviewFinding f : extra) byTitle.putIfAbsent(f.title().toLowerCase(), f);
        return new ArrayList<>(byTitle.values());
    }

    private List<ReviewFinding> sort(List<ReviewFinding> in) {
        List<ReviewFinding> out = new ArrayList<>(in);
        out.sort((a, b) -> rank(b.severity()) - rank(a.severity()));
        return out;
    }

    private int rank(String severity) {
        return switch (severity == null ? "" : severity.toLowerCase()) {
            case "risk" -> 3;
            case "warn" -> 2;
            default -> 1;
        };
    }

    private String normSeverity(String s) {
        String v = s == null ? "" : s.toLowerCase();
        if (v.startsWith("risk") || v.startsWith("crit") || v.startsWith("high")) return "risk";
        if (v.startsWith("warn") || v.startsWith("med")) return "warn";
        return "info";
    }

    private static boolean any(String hay, String... keys) {
        for (String k : keys) {
            if (hay.contains(k)) return true;
        }
        return false;
    }

    private ReviewFinding f(String sev, String cat, String title, String detail, String suggestion) {
        return new ReviewFinding(sev, cat, title, detail, suggestion);
    }

    private static String extractJsonObject(String text) {
        if (text == null) return "{}";
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        return (start >= 0 && end > start) ? text.substring(start, end + 1) : "{}";
    }

    private DesignReviewRequest normalize(DesignReviewRequest req) {
        String goal = req == null || req.goal() == null ? "" : req.goal().trim();
        List<DesignReviewRequest.Block> blocks = req == null || req.blocks() == null ? List.of() : req.blocks();
        List<DesignReviewRequest.Link> links = req == null || req.links() == null ? List.of() : req.links();
        return new DesignReviewRequest(goal, blocks, links);
    }
}
