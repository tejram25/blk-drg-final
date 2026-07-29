package com.example.diagram.web;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.config.Region;
import com.example.diagram.service.PartSearchService;
import com.example.diagram.web.dto.PartSearchResponse;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Parts catalogue search. The frontend calls this rather than the catalogue
 * directly, so credentials stay server-side and every client gets the same
 * de-duplicated model (see PartSearchNormalizer). Thin: delegates to the
 * service layer.
 */
@RestController
@RequestMapping("/api")
public class PartSearchController {

    private static final Logger log = LoggerFactory.getLogger(PartSearchController.class);

    private final PartSearchService parts;
    private final ArrowProperties props;

    public PartSearchController(PartSearchService parts, ArrowProperties props) {
        this.parts = parts;
        this.props = props;
    }

    /**
     * Search the catalogue. {@code q} is required; the rest narrow the result
     * after grouping, so the counts still describe what the user is looking at.
     */
    @GetMapping(value = "/parts/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public PartSearchResponse search(
            @RequestParam("q") String query,
            @RequestParam(value = "manufacturer", required = false) String manufacturer,
            @RequestParam(value = "inStock", required = false, defaultValue = "false") boolean inStockOnly,
            @RequestParam(value = "active", required = false, defaultValue = "false") boolean activeOnly,
            @RequestParam(value = "start", required = false, defaultValue = "0") int start,
            @RequestParam(value = "limit", required = false, defaultValue = "25") int limit,
            @RequestParam(value = "region", required = false) String region) {
        return parts.search(query, manufacturer, inStockOnly, activeOnly,
                Math.max(start, 0), Math.max(1, Math.min(limit, 100)),
                Region.orDefault(region, props.getRegion()));
    }

    /** The regions this deployment can search, for the region picker. */
    @GetMapping(value = "/parts/regions", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<Map<String, String>> regions() {
        return Arrays.stream(Region.values())
                .map(r -> Map.of("code", r.code(), "label", r.label(),
                        "default", String.valueOf(r == props.getRegion())))
                .toList();
    }

    /**
     * The same part looked up in every region.
     *
     * <p>Answers the question a block diagram actually raises: this part is fine
     * where I am, but the board is also built elsewhere — can that plant get it?
     * Stock, lead time and price are regional, so one region's answer says
     * nothing about another's.
     *
     * <p>A region that fails or has no match is reported as absent rather than
     * failing the whole call: a partial answer is more useful than none, and one
     * regional outage should not blank the comparison.
     */
    @GetMapping(value = "/parts/availability", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> availability(@RequestParam("part") String partNumber) {
        Map<String, Object> byRegion = new LinkedHashMap<>();
        for (Region r : Region.values()) {
            try {
                PartSearchResponse res = parts.search(partNumber, null, false, false, 0, 25, r);
                res.parts().stream()
                        .filter(p -> p.partNumber().equalsIgnoreCase(partNumber.trim()))
                        .findFirst()
                        .or(() -> res.parts().stream().findFirst())
                        .ifPresent(p -> byRegion.put(r.code(), p));
            } catch (RuntimeException ex) {
                log.warn("Availability lookup failed for {} in {}: {}",
                        partNumber, r.code(), ex.toString());
            }
        }
        return Map.of("partNumber", partNumber, "regions", byRegion);
    }

    /** Connectivity check — reports whether the catalogue is reachable. */
    @GetMapping(value = "/parts/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> health() {
        return parts.health();
    }
}
