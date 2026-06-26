package com.example.diagram.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the Claude (Anthropic) API used by the AI recommendation
 * feature. The API key is supplied via env var {@code ANTHROPIC_API_KEY} or a
 * gitignored application-local.properties — never committed. When no key is
 * present the recommendation service falls back to a deterministic rule-based
 * engine, so the feature works offline.
 */
@Component
@ConfigurationProperties(prefix = "anthropic")
public class AnthropicProperties {

    /** API key — leave empty to use the rule-based fallback. */
    private String apiKey = "";

    /** Model id. Defaults to the latest Opus. */
    private String model = "claude-opus-4-8";

    private String baseUrl = "https://api.anthropic.com";

    private String version = "2023-06-01";

    private int maxTokens = 1500;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
}
