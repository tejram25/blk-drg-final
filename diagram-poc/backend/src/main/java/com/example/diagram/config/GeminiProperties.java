package com.example.diagram.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the Google Gemini API used by the AI recommendation
 * feature. The API key is supplied via env var {@code GEMINI_API_KEY} or a
 * gitignored application-local.properties — never committed. When no key is
 * present the recommendation service falls back to a deterministic rule-based
 * engine, so the feature works offline.
 *
 * <p>A free API key (no credit card) can be created at
 * <a href="https://aistudio.google.com/app/apikey">Google AI Studio</a>.
 */
@Component
@ConfigurationProperties(prefix = "gemini")
public class GeminiProperties {

    /** API key — leave empty to use the rule-based fallback. */
    private String apiKey = "";

    /** Model id. Defaults to gemini-2.0-flash (fast, free tier). */
    private String model = "gemini-2.0-flash";

    private String baseUrl = "https://generativelanguage.googleapis.com";

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

    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
}
