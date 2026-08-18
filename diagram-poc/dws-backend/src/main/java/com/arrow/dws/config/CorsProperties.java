package com.arrow.dws.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Which browser origins may call this API.
 *
 * <p>Typed configuration rather than {@code @Value} on a comma-separated
 * string: the list is a list, it fails at startup rather than at the first
 * request if it is malformed, and it is discoverable in the IDE.
 */
@ConfigurationProperties(prefix = "dws.cors")
public class CorsProperties {

    /**
     * Origin patterns, not origins — wildcards are allowed. Patterns are used
     * because Salesforce sandboxes each have their own host and enumerating
     * them is a losing game.
     */
    private List<String> allowedOriginPatterns = new ArrayList<>();

    public List<String> getAllowedOriginPatterns() {
        return allowedOriginPatterns;
    }

    public void setAllowedOriginPatterns(List<String> allowedOriginPatterns) {
        this.allowedOriginPatterns = allowedOriginPatterns;
    }
}
