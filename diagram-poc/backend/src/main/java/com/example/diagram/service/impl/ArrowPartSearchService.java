package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.service.PartSearchNormalizer;
import com.example.diagram.service.PartSearchService;
import com.example.diagram.web.dto.CatalogPart;
import com.example.diagram.web.dto.PartSearchResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Live part search against the APIM part service
 * ({@code /eupartservice/search?srchtxt=…&render=json&appid=gen}).
 *
 * <p>Authentication and transport are delegated to {@link ArrowApiClient} so the
 * credentials stay server-side; the response is passed through
 * {@link PartSearchNormalizer}, the same one the mock uses, so both paths
 * produce an identical de-duplicated model.
 *
 * <p>Disabled when {@code arrow.mock=true}, where {@link MockPartSearchService}
 * takes over.
 */
@Service
@ConditionalOnProperty(name = "arrow.mock", havingValue = "false", matchIfMissing = false)
public class ArrowPartSearchService implements PartSearchService {

    private final ArrowProperties props;
    private final ArrowApiClient client;
    private final PartSearchNormalizer normalizer;
    private final ObjectMapper objectMapper;

    public ArrowPartSearchService(ArrowProperties props, ArrowApiClient client,
                                  PartSearchNormalizer normalizer, ObjectMapper objectMapper) {
        this.props = props;
        this.client = client;
        this.normalizer = normalizer;
        this.objectMapper = objectMapper;
    }

    @Override
    public PartSearchResponse search(String query, String manufacturer,
                                     boolean inStockOnly, boolean activeOnly) {
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
        // The upstream filters by supplier, not manufacturer; manufacturer is
        // applied below against the normalised result.
        String json = client.getJson(url.encode().build().toUriString());

        PartSearchResponse response;
        try {
            response = normalizer.normalize(objectMapper.readTree(json), query);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not read the parts catalogue response.", ex);
        }
        return filter(response, manufacturer, inStockOnly, activeOnly);
    }

    private PartSearchResponse filter(PartSearchResponse r, String manufacturer,
                                      boolean inStockOnly, boolean activeOnly) {
        String mfr = manufacturer == null ? "" : manufacturer.trim().toLowerCase();
        List<CatalogPart> kept = r.parts().stream()
                .filter(p -> mfr.isEmpty() || p.manufacturer().toLowerCase().contains(mfr))
                .filter(p -> !inStockOnly || p.stock().totalOnHand() > 0)
                .filter(p -> !activeOnly || p.locations().stream()
                        .anyMatch(l -> "Active".equalsIgnoreCase(l.status())))
                .toList();
        return new PartSearchResponse(r.query(), r.returned(), r.total(),
                r.exactMatchFound(), r.matchReason(), kept);
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
