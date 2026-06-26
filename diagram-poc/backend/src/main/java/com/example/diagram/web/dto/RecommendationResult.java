package com.example.diagram.web.dto;

import java.util.List;

/** Recommendations plus provenance (which model produced them, or rule-based). */
public record RecommendationResult(
        List<RecommendationItem> items,
        String model,
        boolean aiGenerated,
        String note) {}
