package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Shared client for the Arrow APIM Design Win APIs. Obtains and caches the
 * OAuth2 client-credentials Bearer token (the secret never leaves the server),
 * then performs authenticated GETs for part search and the Design Win endpoints.
 * Upstream failures are logged with their real cause (status + body) and
 * surfaced with a clear, non-secret reason.
 *
 * <p>The authentication flow is unchanged from the original part-search client:
 * same token endpoint, {@code Version} header, {@code client_credentials} body
 * and token caching.
 */
@Component
public class ArrowApiClient {

    private static final Logger log = LoggerFactory.getLogger(ArrowApiClient.class);

    private final ArrowProperties props;
    private final ObjectMapper objectMapper;
    private final RestClient http;

    private String cachedToken;
    private Instant tokenExpiry = Instant.EPOCH;

    public ArrowApiClient(ArrowProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.http = RestClient.create();
    }

    public boolean isConfigured() {
        return props.isConfigured();
    }

    /** Authenticated GET returning the raw JSON body. */
    public String getJson(String url) {
        if (!props.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Arrow API is not configured. Please try again later.");
        }
        // The callers already fully percent-encode the URL (UriComponentsBuilder.encode()).
        // Passing that String to RestClient.uri(String) would treat it as a URI *template*
        // and encode it a second time ('%20' -> '%2520'), so query values like a customer
        // name with spaces reach Arrow garbled and it returns "Success" with no data.
        // Passing a java.net.URI sends the URL verbatim, with no further encoding.
        final URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException ex) {
            log.error("Arrow GET URL is not a valid URI: {}", url);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not build a valid Arrow API request URL.");
        }
        long started = System.currentTimeMillis();
        log.info("→ Arrow API GET {}", uri);
        try {
            String body = http.get()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + token())
                    .retrieve()
                    .body(String.class);
            log.info("← Arrow API GET {} ({} ms, {} chars)", url,
                    System.currentTimeMillis() - started, body == null ? 0 : body.length());
            return body;
        } catch (RestClientResponseException ex) {
            log.error("Arrow GET {} failed: HTTP {} - {}", url, ex.getStatusCode().value(),
                    truncate(ex.getResponseBodyAsString()));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Arrow API returned HTTP " + ex.getStatusCode().value() + ".");
        } catch (RestClientException ex) {
            log.error("Arrow GET {} could not be sent: {}", url, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach the Arrow API (" + rootCauseType(ex) + ").");
        }
    }

    /** Return a cached token, refreshing it shortly before it expires. */
    private synchronized String token() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiry)) {
            log.debug("Arrow token served from cache (valid until {})", tokenExpiry);
            return cachedToken;
        }
        log.info("→ Arrow token request {}", props.tokenUrl());
        String body;
        try {
            body = http.post()
                    .uri(props.tokenUrl())
                    .header("Version", props.getVersion())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "grant_type", "client_credentials",
                            "client_id", props.getClientId(),
                            "client_secret", props.getClientSecret()))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException ex) {
            String upstream = truncate(ex.getResponseBodyAsString());
            log.error("Arrow token request rejected: HTTP {} - {}", ex.getStatusCode().value(), upstream);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Arrow authentication failed — auth host returned HTTP " + ex.getStatusCode().value()
                            + ". Upstream said: " + upstream);
        } catch (RestClientException ex) {
            String cause = rootCauseType(ex);
            log.error("Arrow token request could not be sent (is the host reachable?): {} [{}]", ex.getMessage(), cause);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Arrow authentication failed — could not reach auth host " + hostOf(props.tokenUrl())
                            + " (" + cause + "). Are you on the Arrow network/VPN?");
        }

        try {
            JsonNode node = objectMapper.readTree(body == null ? "" : body);
            String token = firstNonBlank(
                    node.path("access_token").asText(null),
                    node.at("/data/access_token").asText(null),
                    node.path("accessToken").asText(null),
                    node.path("token").asText(null));
            if (token == null) {
                log.error("Arrow token response had no recognizable token field: {}", truncate(body));
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Arrow authentication failed — auth response had no access_token field.");
            }
            long expiresIn = node.path("expires_in").asLong(node.path("expiresIn").asLong(3600));
            cachedToken = token;
            tokenExpiry = Instant.now().plusSeconds(Math.max(60, expiresIn - 60));
            log.info("← Arrow token acquired (expires in ~{}s, cached until {})", expiresIn, tokenExpiry);
            return cachedToken;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Arrow token response was not valid JSON: {}", truncate(body));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Arrow authentication failed — auth response was not valid JSON.");
        }
    }

    /** Force a fresh authentication and report the outcome (no secrets). */
    public Map<String, Object> authHealth() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("configured", props.isConfigured());
        out.put("tokenUrl", props.tokenUrl());
        if (!props.isConfigured()) {
            out.put("ok", false);
            out.put("stage", "config");
            out.put("detail", "ARROW_CLIENT_ID / ARROW_CLIENT_SECRET are not set.");
            return out;
        }
        cachedToken = null;
        tokenExpiry = Instant.EPOCH;
        try {
            String token = token();
            out.put("ok", true);
            out.put("stage", "token");
            out.put("detail", "Authenticated — token acquired (" + token.length() + " chars).");
        } catch (ResponseStatusException ex) {
            out.put("ok", false);
            out.put("stage", "token");
            out.put("detail", ex.getReason());
        }
        return out;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String truncate(String s) {
        if (s == null) return "<empty>";
        return s.length() > 500 ? s.substring(0, 500) + "…" : s;
    }

    private static String rootCauseType(Throwable ex) {
        Throwable root = ex;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return root.getClass().getSimpleName();
    }

    private static String hostOf(String url) {
        try {
            return java.net.URI.create(url).getHost();
        } catch (Exception ex) {
            return url;
        }
    }
}
