package com.example.diagram.web;

import com.example.diagram.service.PartSearchService;
import com.example.diagram.web.dto.PartSearchResponse;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

    private final PartSearchService parts;

    public PartSearchController(PartSearchService parts) {
        this.parts = parts;
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
            @RequestParam(value = "limit", required = false, defaultValue = "25") int limit) {
        return parts.search(query, manufacturer, inStockOnly, activeOnly,
                Math.max(start, 0), Math.max(1, Math.min(limit, 100)));
    }

    /** Connectivity check — reports whether the catalogue is reachable. */
    @GetMapping(value = "/parts/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> health() {
        return parts.health();
    }
}
