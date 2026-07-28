package com.example.diagram.service.impl;

import com.example.diagram.service.PartSearchNormalizer;
import com.example.diagram.service.PartSearchService;
import com.example.diagram.web.dto.CatalogPart;
import com.example.diagram.web.dto.PartLocation;
import com.example.diagram.web.dto.PartSearchResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Offline implementation of part search, serving a bundled catalogue so the
 * search → link → BOM flow works without live credentials.
 *
 * <p>The catalogue is the two bundled samples merged: a captured real response
 * (BAV99 across 25 inventory organisations — the case that proves the
 * de-duplication) plus a handful of other parts so other searches return
 * something. Swap for a live client behind the same interface.
 */
@Service
@ConditionalOnProperty(name = "arrow.mock", havingValue = "true", matchIfMissing = true)
public class MockPartSearchService implements PartSearchService {

    private static final Logger log = LoggerFactory.getLogger(MockPartSearchService.class);

    private final ObjectMapper objectMapper;
    private final PartSearchNormalizer normalizer;
    private final ArrayNode catalogue;

    public MockPartSearchService(ObjectMapper objectMapper, PartSearchNormalizer normalizer) {
        this.objectMapper = objectMapper;
        this.normalizer = normalizer;
        this.catalogue = objectMapper.createArrayNode();
        load("/sample-partsearch.json");
        load("/sample-parts.json");
    }

    private void load(String resource) {
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            if (in == null) return;
            for (JsonNode part : objectMapper.readTree(in).path("partserviceresult").path("parts")) {
                catalogue.add(part);
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Could not load " + resource, ex);
        }
    }

    @PostConstruct
    void announce() {
        log.info("Parts search: MOCK mode — {} catalogue rows bundled.", catalogue.size());
    }

    @Override
    public PartSearchResponse search(String query, String manufacturer, boolean inStockOnly, boolean activeOnly) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search text is required.");
        }
        String q = query.trim().toLowerCase();

        ArrayNode matched = objectMapper.createArrayNode();
        for (JsonNode part : catalogue) {
            if (haystack(part).contains(q)) matched.add(part);
        }

        // Re-wrap as a partserviceresult so the same normaliser handles mock and
        // live responses — there is no second code path to keep in step.
        ObjectNode result = objectMapper.createObjectNode();
        result.set("parts", matched);
        result.put("numItems", matched.size());
        result.put("totalItems", matched.size());
        result.put("exactMatchFound", exactMatch(matched, q) ? "Y" : "N");
        result.putObject("matchReason").put("description", "Srchtxt Match");
        ObjectNode root = objectMapper.createObjectNode();
        root.set("partserviceresult", result);

        PartSearchResponse response = normalizer.normalize(root, query);
        return filter(response, manufacturer, inStockOnly, activeOnly);
    }

    /** Post-normalisation filters, applied to the grouped parts. */
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

    private boolean exactMatch(ArrayNode rows, String q) {
        for (JsonNode row : rows) {
            if (row.at("/arwPartNum/name").asText("").equalsIgnoreCase(q)) return true;
        }
        return false;
    }

    private String haystack(JsonNode part) {
        StringBuilder sb = new StringBuilder()
                .append(part.at("/arwPartNum/name").asText("")).append(' ')
                .append(part.at("/suppPartNum/name").asText("")).append(' ')
                .append(part.at("/mfr/name").asText("")).append(' ')
                .append(part.at("/supp/name").asText("")).append(' ')
                .append(part.at("/icc/name").asText("")).append(' ')
                .append(part.at("/icc/tree").asText("")).append(' ');
        for (JsonNode org : part.path("invOrgs")) sb.append(org.path("desc").asText("")).append(' ');
        return sb.toString().toLowerCase();
    }

    @Override
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("mock", true);
        out.put("rows", catalogue.size());
        out.put("detail", "Mock mode — serving the bundled sample catalogue.");
        return out;
    }
}
