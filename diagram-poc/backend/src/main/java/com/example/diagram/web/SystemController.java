package com.example.diagram.web;

import java.time.Instant;
import java.util.Map;

import com.example.diagram.config.OllamaProperties;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lightweight status/version endpoint for IT support ownership. Pairs with
 * Spring Boot Actuator's {@code /actuator/health} (public) so uptime, version
 * and operating mode are observable without digging into logs. The UI also
 * reads {@code aiEnabled} here to grey out / short-circuit AI-only actions
 * (e.g. image-to-diagram) instead of calling them and failing.
 */
@RestController
@RequestMapping("/api/system")
public class SystemController {

    @Value("${app.version:0.0.1-SNAPSHOT}")
    private String version;

    // Parts/Design-Win always run from the bundled sample catalogue (offline).
    @Value("${app.offline-mode:true}")
    private boolean partsMock;

    private final OllamaProperties ollama;
    private final Instant startedAt = Instant.now();

    public SystemController(OllamaProperties ollama) {
        this.ollama = ollama;
    }

    @GetMapping("/info")
    public Map<String, Object> info() {
        return Map.of(
                "name", "Block Diagram Builder",
                "version", version,
                "partsMode", partsMock ? "mock" : "live",
                // Local vision/LLM (Ollama) on? Drives the UI's AI-feature gating.
                "aiEnabled", ollama.isEnabled(),
                "startedAt", startedAt.toString(),
                "serverTime", Instant.now().toString());
    }
}
