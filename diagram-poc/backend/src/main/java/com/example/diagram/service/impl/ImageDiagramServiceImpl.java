package com.example.diagram.service.impl;

import com.example.diagram.config.OllamaProperties;
import com.example.diagram.service.ImageDiagramService;
import com.example.diagram.web.dto.ImageDiagramResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Extracts a block diagram from an image using a local Ollama vision model
 * (OpenAI-compatible {@code /v1/chat/completions} with an {@code image_url}
 * content part). The model returns the blocks (label, kind, position) and the
 * connections between them as JSON; the frontend maps each block to a real
 * palette component. Reuses the existing Ollama transport/config — no API key.
 */
@Service
public class ImageDiagramServiceImpl implements ImageDiagramService {

    private static final Logger log = LoggerFactory.getLogger(ImageDiagramServiceImpl.class);

    private static final String SYSTEM = """
            You extract BLOCK DIAGRAMS from images for an electronics design tool.
            Look at the image and identify every block/box/component and every
            connecting line/arrow between them.

            Return ONLY minified JSON, no prose, of exactly this shape:
            {"title":"<short title>","nodes":[{"id":"n1","label":"<title in the block>",
            "sub":"<smaller role text under it, or empty>","kind":"<one keyword>",
            "color":"<box fill colour as #rrggbb, or empty>","x":<0-1000>,"y":<0-700>}],
            "links":[{"from":"n1","to":"n2","label":""}]}

            Rules:
            - One node per distinct block. id is n1, n2, ... label is the main text in the
              block; sub is the smaller caption under/near it (e.g. "Digital Processing"), else "".
            - color is the block's fill colour as a #rrggbb hex (approximate from the image), else "".
            - kind is ONE lowercase keyword picked from: processor, mcu, ai, memory, sensor,
              camera, motor, battery, power, dcdc, comms, wifi, antenna, display, storage,
              connector, logic, input, output, clock, amplifier, regulator, process, decision,
              data, generic. Choose the closest.
            - x,y is the block's approximate CENTRE in the image: x from 0 (left) to 1000
              (right), y from 0 (top) to 700 (bottom). Preserve the relative layout.
            - Every link's from/to must be ids that exist in nodes. Use link label "" if none.
            - Do not invent blocks that are not in the image. Output JSON only.
            """;

    private final OllamaProperties props;
    private final ObjectMapper mapper;
    private final RestClient rest;

    public ImageDiagramServiceImpl(OllamaProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(Duration.ofSeconds(5))
                .withReadTimeout(Duration.ofSeconds(90));
        this.rest = RestClient.builder()
                .requestFactory(ClientHttpRequestFactories.get(settings))
                .build();
    }

    @Override
    public ImageDiagramResult extract(String imageData) {
        if (!props.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Image-to-diagram needs a local AI vision model. Enable Ollama (OLLAMA_ENABLED=true) "
                            + "and pull a vision model, e.g. `ollama pull " + props.getVisionModel() + "`.");
        }
        String dataUrl = toDataUrl(imageData);

        Map<String, Object> body = Map.of(
                "model", props.getVisionModel(),
                "max_tokens", props.getMaxTokens(),
                "stream", false,
                "messages", List.of(Map.of(
                        "role", "user",
                        "content", List.of(
                                Map.of("type", "text", "text",
                                        "Extract the block diagram from this image as JSON."),
                                Map.of("type", "image_url",
                                        "image_url", Map.of("url", dataUrl))))));

        long started = System.currentTimeMillis();
        log.info("→ Ollama vision {} (image-to-diagram) @ {}", props.getVisionModel(),
                props.getBaseUrl() + "/v1/chat/completions");
        JsonNode resp;
        try {
            resp = rest.post()
                    .uri(props.getBaseUrl() + "/v1/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException ex) {
            log.error("Ollama vision request failed: {}", ex.toString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach the local AI vision model (" + props.getVisionModel()
                            + "). Is Ollama running and the model pulled?");
        }

        String text = resp == null ? "" : resp.at("/choices/0/message/content").asText("");
        log.info("← Ollama vision {} ({} ms): {} chars", props.getVisionModel(),
                System.currentTimeMillis() - started, text.length());

        ImageDiagramResult result = parse(text);
        if (result.nodes().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The AI could not find any blocks in that image. Try a clearer, higher-contrast diagram.");
        }
        return result;
    }

    /** Parse the model's JSON (tolerating code fences / stray prose) into a result. */
    private ImageDiagramResult parse(String text) {
        String json = extractJsonObject(text);
        List<ImageDiagramResult.Node> nodes = new ArrayList<>();
        List<ImageDiagramResult.Link> links = new ArrayList<>();
        String title = "Imported diagram";
        try {
            JsonNode root = mapper.readTree(json);
            title = firstNonBlank(root.path("title").asText(""), "Imported diagram");
            int i = 0;
            for (JsonNode n : root.path("nodes")) {
                String id = firstNonBlank(n.path("id").asText(""), "n" + (++i));
                String label = n.path("label").asText("").trim();
                String sub = n.path("sub").asText("").trim();
                String kind = n.path("kind").asText("generic").trim().toLowerCase();
                String color = n.path("color").asText("").trim();
                int x = clamp(n.path("x").asInt(0), 0, 1000);
                int y = clamp(n.path("y").asInt(0), 0, 700);
                nodes.add(new ImageDiagramResult.Node(id, label, sub, kind.isBlank() ? "generic" : kind, color, x, y));
            }
            for (JsonNode l : root.path("links")) {
                String from = l.path("from").asText("").trim();
                String to = l.path("to").asText("").trim();
                if (!from.isBlank() && !to.isBlank()) {
                    links.add(new ImageDiagramResult.Link(from, to, l.path("label").asText("")));
                }
            }
        } catch (Exception ex) {
            log.warn("Could not parse vision model output as diagram JSON: {}", ex.toString());
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The AI returned an unreadable result. Please try again with a clearer image.");
        }
        return new ImageDiagramResult(title, nodes, links, "Local vision AI (" + props.getVisionModel() + ")",
                "Generated from your image — review and adjust the blocks and connections.");
    }

    /** Ensure a browser-friendly data URL for the vision endpoint. */
    private static String toDataUrl(String imageData) {
        if (imageData == null || imageData.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No image was provided.");
        }
        String s = imageData.trim();
        return s.startsWith("data:") ? s : "data:image/png;base64," + s;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    /** First balanced-ish JSON object substring, tolerating fences/prose around it. */
    private static String extractJsonObject(String text) {
        if (text == null) return "{}";
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        return (start >= 0 && end > start) ? text.substring(start, end + 1) : "{}";
    }
}
