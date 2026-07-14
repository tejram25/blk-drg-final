package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.service.PartSearchService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Server-side proxy for the Arrow APIM Part Search API. Builds the documented
 * search URL and delegates authentication + transport to {@link ArrowApiClient}.
 *
 * <p>Disabled when {@code arrow.mock=true} (the {@link MockPartSearchService}
 * takes over so the flow can be tried offline).
 */
@Service
@ConditionalOnProperty(name = "arrow.mock", havingValue = "false", matchIfMissing = true)
public class ArrowPartSearchService implements PartSearchService {

    private final ArrowProperties props;
    private final ArrowApiClient client;

    public ArrowPartSearchService(ArrowProperties props, ArrowApiClient client) {
        this.props = props;
        this.client = client;
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
        UriComponentsBuilder url = UriComponentsBuilder.fromHttpUrl(props.searchUrl())
                .queryParam("srchtxt", query)
                .queryParam("render", "json")
                .queryParam("appid", props.getAppId() == null || props.getAppId().isBlank()
                        ? "gen" : props.getAppId())
                .queryParam("start", 0)
                .queryParam("limit", props.getSearchLimit());
        if (supplier != null && !supplier.isBlank()) {
            url.queryParam("suppname", supplier);
        }
        if (designWin) {
            url.queryParam("dw", "true");
        }
        return client.getJson(url.encode().build().toUriString());
    }

    @Override
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("mock", false);
        out.put("searchUrl", props.searchUrl());
        out.putAll(client.authHealth());
        return out;
    }
}
