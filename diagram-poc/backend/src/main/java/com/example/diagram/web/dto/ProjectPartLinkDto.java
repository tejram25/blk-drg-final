package com.example.diagram.web.dto;

/**
 * A persisted project part-link, as the UI reads it back.
 *
 * <p>{@code part} is the full normalised CatalogPart as raw JSON, so the client
 * rehydrates the exact card it linked without another catalogue call. The flat
 * fields duplicate the queryable columns for convenience.
 */
public record ProjectPartLinkDto(
        String partId,
        String partNumber,
        String manufacturer,
        String description,
        String status,
        String unitPrice,
        String currency,
        int quantity,
        String linkedBy,
        String part) {}
