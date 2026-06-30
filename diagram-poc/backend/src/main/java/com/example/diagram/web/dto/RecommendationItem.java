package com.example.diagram.web.dto;

/**
 * One recommendation with source traceability and a verification prompt.
 * {@code type} ∈ template|part|solution; {@code source} states where it came
 * from (e.g. "Template repository", "Arrow catalogue"); {@code verify} is an
 * explicit prompt to check specs/datasheets. {@code query} is the catalogue
 * search term to re-run when the user adds the item, so they can pick the
 * supplier/variant (empty for non-part items).
 */
public record RecommendationItem(
        String type,
        String title,
        String detail,
        String source,
        String verify,
        String query) {}
