package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.config.Region;
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
                                     int start, int limit, Region region) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search text is required.");
        }
        if (!props.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Parts search is currently unavailable. Please try again later.");
        }
        // The upstream filters by supplier, not manufacturer; manufacturer is
        // applied below against the normalised result.
        Region r = region == null ? props.getRegion() : region;
        String json = client.getJson(searchUrl(query, Math.max(start, 0),
                limit > 0 ? limit : props.getSearchLimit(), r));

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
     * Build the upstream search URL for a region.
     *
     * <p>The region is the path prefix — {@code /eupartservice/search},
     * {@code /appartservice/search}, {@code /acpartservice/search} — and also
     * selects the warehouse list, since inventory-organisation codes are
     * regional.
     *
     * <p>Package-private so the request shape can be asserted without a live
     * catalogue: a wrong region or warehouse list returns a perfectly valid
     * response with the wrong stock figures rather than an error.
     */
    String searchUrl(String query, int start, int limit, Region region) {
        int size = Math.max(limit, 1);
        return UriComponentsBuilder.fromHttpUrl(props.searchUrl(region))
                .queryParam("srchtxt", query)
                .queryParam("ioebs", props.invOrgsFor(region))
                .queryParam("source", props.getSource())
                .queryParam("srchmode", props.getSearchMode())
                .queryParam("whsetype", props.getWarehouseType())
                .queryParam("retWhseFilter", props.isReturnWarehouseFilter() ? "Y" : "N")
                .queryParam("ftzBoostFlag", props.isFtzBoost() ? "Y" : "N")
                .queryParam("enableStcFlagFilter", props.isStcFlagFilter() ? "Y" : "N")
                .queryParam("limit", size)
                .queryParam("start", start)
                // The service pages by page as well as offset; derived so the
                // two cannot disagree. Page is 1-based.
                .queryParam("page", start / size + 1)
                // encode() percent-escapes the query values. Part numbers
                // legitimately contain '#' (LTC1732EMS-4.2#PBF); unescaped it
                // would start a URI fragment and truncate the query.
                .encode().build().toUriString();
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
        out.put("region", props.getRegion().code());
        out.put("regions", java.util.Arrays.stream(Region.values()).map(Region::code).toList());
        // The exact request per region, so a wrong warehouse list or a bad
        // region path is visible here rather than only as odd stock figures.
        Map<String, String> queries = new LinkedHashMap<>();
        for (Region r : Region.values()) {
            queries.put(r.code(), searchUrl("BAV99", 0, props.getSearchLimit(), r));
        }
        out.put("sampleQueries", queries);
        out.putAll(client.authHealth());
        return out;
    }
}
