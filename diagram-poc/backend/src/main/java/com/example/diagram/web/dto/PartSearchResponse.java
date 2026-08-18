package com.example.diagram.web.dto;

import java.util.List;

/**
 * A page of catalogue search results.
 *
 * <p>{@code returned} counts upstream rows; {@code parts} is smaller whenever
 * several of those rows were the same item in different warehouses (see
 * {@link CatalogPart}). Both are reported so the UI can say "25 catalogue rows
 * → 1 part" honestly.
 *
 * <p>Paging is over <b>upstream rows</b>, not parts, because that is what the
 * catalogue pages: asking for rows 25–50 can yield no new parts at all if they
 * are more locations for parts already seen. {@code hasMore} therefore drives
 * "load more", not the size of {@code parts}.
 *
 * @param query           the search text that produced these results
 * @param start           first upstream row in this page
 * @param returned        rows returned in this page
 * @param nextStart       first row of the next page
 * @param hasMore         whether more rows exist upstream
 * @param total           total rows matching upstream, across all pages
 * @param exactMatchFound whether an exact part-number match was found
 * @param matchReason     why the upstream matched, e.g. "Srchtxt Match"
 * @param parts           the de-duplicated parts in this page
 */
public record PartSearchResponse(
        String query,
        int start,
        int returned,
        int nextStart,
        boolean hasMore,
        long total,
        boolean exactMatchFound,
        String matchReason,
        List<CatalogPart> parts) {}
