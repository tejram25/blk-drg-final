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
                                     boolean inStockOnly, boolean activeOnly,
                                     int start, int limit) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search text is required.");
        }
        if (!props.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Parts search is currently unavailable. Please try again later.");
        }
        // The upstream filters by supplier, not manufacturer; manufacturer is
        // applied below against the normalised result.
        String json = client.getJson(searchUrl(query, Math.max(start, 0),
                limit > 0 ? limit : props.getSearchLimit()));

        PartSearchResponse response;
        try {
            response = normalizer.normalize(objectMapper.readTree(json), query, Math.max(start, 0));
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not read the parts catalogue response.", ex);
        }
        return filter(response, manufacturer, inStockOnly, activeOnly);
    }

    /**
     * Build the upstream search URL for the configured endpoint contract.
     *
     * <p>Package-private so the shape of the request can be asserted without a
     * live catalogue — the parameter sets differ enough between the two
     * endpoints that a typo silently returns the wrong page rather than failing.
     */
    String searchUrl(String query, int start, int limit) {
        UriComponentsBuilder url = UriComponentsBuilder.fromHttpUrl(props.searchUrl())
                .queryParam("srchtxt", query);

        if (props.getSearchApi() == ArrowProperties.SearchApi.ACPARTSERVICE) {
            // Workbench endpoint. It pages by page *and* offset, so both are
            // sent and kept consistent — page is 1-based.
            url.queryParam("ioebs", props.getInvOrgs())
                    .queryParam("source", props.getSource())
                    .queryParam("srchmode", props.getSearchMode())
                    .queryParam("whsetype", props.getWarehouseType())
                    .queryParam("retWhseFilter", props.isReturnWarehouseFilter() ? "Y" : "N")
                    .queryParam("ftzBoostFlag", props.isFtzBoost() ? "Y" : "N")
                    .queryParam("enableStcFlagFilter", props.isStcFlagFilter() ? "Y" : "N")
                    .queryParam("limit", limit)
                    .queryParam("start", start)
                    .queryParam("page", start / Math.max(limit, 1) + 1);
        } else {
            url.queryParam("render", "json")
                    .queryParam("appid", props.getAppId() == null || props.getAppId().isBlank()
                            ? "gen" : props.getAppId())
                    .queryParam("start", start)
                    .queryParam("limit", limit);
        }
        // encode() percent-escapes the query values. Part numbers legitimately
        // contain '#' (LTC1732EMS-4.2#PBF); unescaped it would start a URI
        // fragment and silently truncate the query.
        return url.encode().build().toUriString();
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
        return new PartSearchResponse(r.query(), r.start(), r.returned(), r.nextStart(),
                r.hasMore(), r.total(), r.exactMatchFound(), r.matchReason(), kept);
    }

    @Override
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("mock", false);
        out.put("searchUrl", props.searchUrl());
        out.put("searchApi", props.getSearchApi());
        // The exact request shape, so a misconfigured contract is visible here
        // rather than only in an empty result set.
        out.put("sampleQuery", searchUrl("BAV99", 0, props.getSearchLimit()));
        out.putAll(client.authHealth());
        return out;
    }
}
