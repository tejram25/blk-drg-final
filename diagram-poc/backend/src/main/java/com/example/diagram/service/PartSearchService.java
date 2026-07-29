package com.example.diagram.service;

import com.example.diagram.config.Region;
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
     * <p>Paging is over upstream rows, not parts: a page can add locations to
     * parts already seen rather than new parts, so callers page until
     * {@code hasMore} is false rather than until a page looks empty.
     *
     * @param query        required search text
     * @param manufacturer optional manufacturer filter (contains, case-insensitive)
     * @param inStockOnly  keep only parts with stock at some location
     * @param activeOnly   keep only parts Active at some location
     * @param start        first upstream row to return
     * @param limit        maximum upstream rows to return
     * @param region       catalogue region to search; stock, lead time, pricing
     *                     and lifecycle all differ by region
     */
    PartSearchResponse search(String query, String manufacturer, boolean inStockOnly,
                              boolean activeOnly, int start, int limit, Region region);

    /**
     * Diagnostic for {@code GET /api/parts/health}: reports whether the service
     * can reach the catalogue, without exposing secrets.
     */
    Map<String, Object> health();
}
