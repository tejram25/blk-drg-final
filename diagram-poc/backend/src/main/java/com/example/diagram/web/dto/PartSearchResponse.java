package com.example.diagram.web.dto;

import java.util.List;

/**
 * A page of catalogue search results.
 *
 * <p>{@code returned} counts upstream rows; {@code parts} is smaller whenever
 * several of those rows were the same item in different warehouses (see
 * {@link CatalogPart}). Both are reported so the UI can say "8 parts across 25
 * stocking locations" honestly.
 *
 * @param query           the search text that produced these results
 * @param returned        rows returned by the upstream service
 * @param total           total rows matching upstream, across all pages
 * @param exactMatchFound whether an exact part-number match was found
 * @param matchReason     why the upstream matched, e.g. "Srchtxt Match"
 * @param parts           the de-duplicated parts
 */
public record PartSearchResponse(
        String query,
        int returned,
        long total,
        boolean exactMatchFound,
        String matchReason,
        List<CatalogPart> parts) {}
