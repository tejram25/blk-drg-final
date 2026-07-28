package com.example.diagram.service;

import com.example.diagram.web.dto.PartSearchResponse;

import java.util.Map;

/** Searches the parts catalogue. */
public interface PartSearchService {

    /**
     * Search the catalogue and return the normalised result.
     *
     * <p>Implementations return the typed model rather than the upstream JSON:
     * the upstream sends one row per inventory organisation, and de-duplicating
     * that belongs on the server so every client — the Parts tab and the
     * block-diagram panel — sees the same view. See {@link PartSearchNormalizer}.
     *
     * @param query        required search text
     * @param manufacturer optional manufacturer filter (contains, case-insensitive)
     * @param inStockOnly  keep only parts with stock at some location
     * @param activeOnly   keep only parts Active at some location
     */
    PartSearchResponse search(String query, String manufacturer, boolean inStockOnly, boolean activeOnly);

    /**
     * Diagnostic for {@code GET /api/parts/health}: reports whether the service
     * can reach the catalogue, without exposing secrets.
     */
    Map<String, Object> health();
}
