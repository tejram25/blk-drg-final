package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.service.PartSearchService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Server-side proxy for the Arrow APIM Part Search API. Obtains and caches an
 * OAuth2 client-credentials Bearer token from the auth host, then forwards
 * searches to the regional {@code <region>partservice} host. The client secret
 * never leaves the server. Upstream failures are logged with their real cause
 * (status + body), while the caller gets a generic message.
 *
 * <p>Disabled when {@code arrow.mock=true} (the {@link MockPartSearchService}
 * takes over so the flow can be tried offline).
 */
@Service
@ConditionalOnProperty(name = "arrow.mock", havingValue = "false", matchIfMissing = true)
public class ArrowPartSearchService implements PartSearchService {

    private static final Logger log = LoggerFactory.getLogger(ArrowPartSearchService.class);

    private final ArrowProperties props;
    private final ObjectMapper objectMapper;
    private final RestClient http;

    private String cachedToken;
    private Instant tokenExpiry = Instant.EPOCH;

    public ArrowPartSearchService(ArrowProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.http = RestClient.create();
    }

    @Override
    public String search(String query, String supplier, boolean designWin) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search text is required.");
        }
        if (!props.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Parts search is currently unavailable. Please try again later.");
        }
        // Per the APIM docs the search call takes srchtxt + render=json + appid.
        String url = UriComponentsBuilder.fromHttpUrl(props.searchUrl())
                .queryParam("srchtxt", query)
                .queryParam("render", "json")
                .queryParam("appid", props.getAppId() == null || props.getAppId().isBlank()
                        ? "gen" : props.getAppId())
                .build()
                .toUriString();
        try {
            return http.get()
                    .uri(url)
                    .header("Authorization", "Bearer " + token())
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException ex) {
            log.error("Arrow part search failed: HTTP {} - {}", ex.getStatusCode().value(), ex.getResponseBodyAsString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach the parts service.");
        } catch (RestClientException ex) {
            log.error("Arrow part search could not be sent: {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach the parts service.");
        }
    }

    /** Return a cached token, refreshing it shortly before it expires. */
    private synchronized String token() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiry)) {
            return cachedToken;
        }
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
            log.error("Arrow token request rejected: HTTP {} - {}", ex.getStatusCode().value(), ex.getResponseBodyAsString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Parts authentication failed — auth host returned HTTP " + ex.getStatusCode().value()
                            + " (check client-id/secret and that they're valid for this environment).");
        } catch (RestClientException ex) {
            // Connection/DNS/timeout — e.g. the internal Arrow host isn't reachable from here.
            String cause = rootCauseType(ex);
            log.error("Arrow token request could not be sent (is the host reachable?): {} [{}]", ex.getMessage(), cause);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Parts authentication failed — could not reach auth host " + hostOf(props.tokenUrl())
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
                        "Parts authentication failed — auth response had no access_token field.");
            }
            long expiresIn = node.path("expires_in").asLong(node.path("expiresIn").asLong(3600));
            cachedToken = token;
            tokenExpiry = Instant.now().plusSeconds(Math.max(60, expiresIn - 60));
            return cachedToken;
        } catch (ResponseStatusException ex) {
            throw ex; // already a clean failure (no token field)
        } catch (Exception ex) {
            log.error("Arrow token response was not valid JSON: {}", truncate(body));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Parts authentication failed — auth response was not valid JSON.");
        }
    }

    /**
     * Diagnostic: attempts a fresh authentication and reports the outcome (never
     * the secret). Backs {@code GET /api/parts/health} so credentials and
     * connectivity can be checked independently of the search UI.
     */
    @Override
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("mock", false);
        out.put("tokenUrl", props.tokenUrl());
        out.put("searchUrl", props.searchUrl());
        out.put("configured", props.isConfigured());
        if (!props.isConfigured()) {
            out.put("ok", false);
            out.put("stage", "config");
            out.put("detail", "ARROW_CLIENT_ID / ARROW_CLIENT_SECRET are not set.");
            return out;
        }
        // Force a fresh token so we test the live round-trip, not the cache.
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

    /** Innermost cause's simple class name, e.g. UnknownHostException / ConnectException. */
    private static String rootCauseType(Throwable ex) {
        Throwable root = ex;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return root.getClass().getSimpleName();
    }

    /** Host portion of a URL, for clearer "unreachable host" messages. */
    private static String hostOf(String url) {
        try {
            return java.net.URI.create(url).getHost();
        } catch (Exception ex) {
            return url;
        }
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
}
