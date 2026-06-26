package com.example.diagram.web;

import java.time.Instant;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lightweight status/version endpoint for IT support ownership. Pairs with
 * Spring Boot Actuator's {@code /actuator/health} (public) so uptime, version
 * and operating mode are observable without digging into logs.
 */
@RestController
@RequestMapping("/api/system")
public class SystemController {

    @Value("${app.version:0.0.1-SNAPSHOT}")
    private String version;

    @Value("${arrow.mock:false}")
    private boolean partsMock;

    private final Instant startedAt = Instant.now();

    @GetMapping("/info")
    public Map<String, Object> info() {
        return Map.of(
                "name", "Block Diagram Builder",
                "version", version,
                "partsMode", partsMock ? "mock" : "live",
                "startedAt", startedAt.toString(),
                "serverTime", Instant.now().toString());
    }
}
