package com.example.diagram.web.dto;

import java.util.List;

/**
 * A single page of results. The project catalogue runs to thousands of rows, so
 * list endpoints never return the whole set — they return one {@code Page}.
 *
 * <p>Hand-rolled rather than Spring Data's {@code Page} to keep the JSON shape
 * stable and small (Spring Data serialises a large, version-sensitive envelope).
 *
 * @param content       the rows on this page
 * @param page          zero-based page index that was served
 * @param size          page size that was requested
 * @param totalElements total rows matching the query across all pages
 * @param totalPages    total number of pages at this {@code size}
 */
public record Page<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {

    /** Builds a page from a full result list and the requested window. */
    public static <T> Page<T> of(List<T> content, int page, int size, long totalElements) {
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return new Page<>(content, page, size, totalElements, totalPages);
    }
}
