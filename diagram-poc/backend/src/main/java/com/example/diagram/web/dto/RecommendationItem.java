package com.example.diagram.web.dto;

/**
 * One recommendation with source traceability and a verification prompt.
 * {@code type} ∈ template|part|solution; {@code source} states where it came
 * from (e.g. "Template repository", "Arrow catalogue", "Claude — verify");
 * {@code verify} is an explicit prompt to check specs/datasheets.
 */
public record RecommendationItem(
        String type,
        String title,
        String detail,
        String source,
        String verify) {}
