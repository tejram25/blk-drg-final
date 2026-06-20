package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.service.PartSearchService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.Map;

/**
 * Server-side proxy for the Arrow Part Search API. Obtains and caches an OAuth2
 * client-credentials Bearer token, then forwards searches. The client secret
 * never leaves the server.
 */
@Service
public class ArrowPartSearchService implements PartSearchService {

    private final ArrowProperties props;
    private final RestClient http;

    private String cachedToken;
    private Instant tokenExpiry = Instant.EPOCH;

    public ArrowPartSearchService(ArrowProperties props) {
        this.props = props;
        this.http = RestClient.create();
    }

    @Override
    public String search(String query, String supplier, boolean designWin) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search text is required.");
        }
        if (!props.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Parts search isn't configured. Set ARROW_CLIENT_ID and ARROW_CLIENT_SECRET.");
        }
        String url = UriComponentsBuilder.fromHttpUrl(props.getBaseUrl() + props.getSearchPath())
                .queryParam("srchtxt", query)
                .queryParamIfPresent("suppname", java.util.Optional.ofNullable(
                        supplier != null && !supplier.isBlank() ? supplier : null))
                .queryParamIfPresent("dw", java.util.Optional.ofNullable(designWin ? "true" : null))
                .build()
                .toUriString();
        try {
            return http.get()
                    .uri(url)
                    .header("Authorization", "Bearer " + token())
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach the parts service.");
        }
    }

    /** Return a cached token, refreshing it shortly before it expires. */
    private synchronized String token() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiry)) {
            return cachedToken;
        }
        try {
            TokenResponse tr = http.post()
                    .uri(props.getBaseUrl() + props.getTokenPath())
                    .header("version", props.getVersion())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "grant_type", "client_credentials",
                            "client_id", props.getClientId(),
                            "client_secret", props.getClientSecret()))
                    .retrieve()
                    .body(TokenResponse.class);
            if (tr == null || tr.accessToken() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Parts authentication failed.");
            }
            cachedToken = tr.accessToken();
            tokenExpiry = Instant.now().plusSeconds(Math.max(60, tr.expiresIn() - 60));
            return cachedToken;
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Parts authentication failed.");
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenResponse(@JsonProperty("access_token") String accessToken,
                         @JsonProperty("expires_in") long expiresIn) {}
}
