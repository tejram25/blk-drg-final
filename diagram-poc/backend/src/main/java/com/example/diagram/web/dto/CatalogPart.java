package com.example.diagram.web.dto;

import java.util.List;

/**
 * One catalogue part, normalised for the UI.
 *
 * <p>The upstream part service returns <b>one row per inventory organisation</b>
 * — a search for BAV99 comes back as 25 "parts" that are all the same item in
 * different warehouses. Showing that raw is 25 identical rows, so the service
 * groups by {@code itemId} and folds the organisations into {@link #locations},
 * with the headline stock/price/lead-time figures aggregated across them.
 *
 * @param id                 upstream itemId — the identity used for grouping
 * @param partKey            upstream partKey
 * @param partNumber         Arrow part number (falls back to the supplier's)
 * @param supplierPartNumber supplier's own part number
 * @param exactMatch         true when the search text matched this part exactly
 * @param manufacturer       manufacturer name
 * @param supplier           supplier name
 * @param description        part description (from the best-ranked location)
 * @param category           leaf category, e.g. "Rectifier"
 * @param categoryPath       full taxonomy, e.g. [Semiconductor - Discrete, Diodes, Rectifier]
 * @param status             best lifecycle status across locations (Active wins)
 * @param imageUrl           product image, when the catalogue has one
 * @param datasheetUrl       datasheet PDF, when the catalogue has one
 * @param sourcing           supply-risk signals (allocation, PCN, franchised, NCNR …)
 * @param designWinEligible  true when any location is design-win eligible
 * @param crossReferenced    true when alternates/equivalents exist
 * @param crossRefTypes      the kinds of alternate available
 * @param relatedTypes       related-part relationships, e.g. "Marketing Equivalent"
 * @param score              upstream relevance score
 */
public record CatalogPart(
        String id,
        String partKey,
        String partNumber,
        String supplierPartNumber,
        boolean exactMatch,
        String manufacturer,
        String supplier,
        String description,
        String category,
        List<String> categoryPath,
        String status,
        String imageUrl,
        String datasheetUrl,
        PartLeadTime leadTime,
        PartStock stock,
        PartPricing pricing,
        PartPackaging packaging,
        PartCompliance compliance,
        List<PartLocation> locations,
        PartSourcing sourcing,
        boolean designWinEligible,
        boolean crossReferenced,
        List<String> crossRefTypes,
        List<String> relatedTypes,
        double score) {}
