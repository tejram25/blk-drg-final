package com.example.diagram.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for a local <a href="https://ollama.com">Ollama</a> server used
 * by the AI recommendation feature. Ollama runs models on the user's own
 * machine — no API key, no quota, no account — and exposes an OpenAI-compatible
 * endpoint at {@code http://localhost:11434}.
 *
 * <p>Disabled by default so a fresh clone uses the deterministic rule-based
 * engine. Set {@code ollama.enabled=true} (env {@code OLLAMA_ENABLED}) once
 * Ollama is installed and a model has been pulled (e.g. {@code ollama pull llama3.2}).
 */
@Component
@ConfigurationProperties(prefix = "ollama")
public class OllamaProperties {

    /** Turn on the local-AI path. When false, the rule-based fallback is used. */
    private boolean enabled = false;

    /** Model id to run; must already be pulled in Ollama. */
    private String model = "llama3.2";

    private String baseUrl = "http://localhost:11434";

    private int maxTokens = 1500;

    /** True when the local-AI path should be attempted. */
    public boolean isConfigured() {
        return enabled;
    }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
}
