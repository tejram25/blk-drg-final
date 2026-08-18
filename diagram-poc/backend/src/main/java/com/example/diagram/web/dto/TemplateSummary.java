package com.example.diagram.web.dto;

import java.time.Instant;

/** Lightweight template listing for the gallery (no heavy contentJson). */
public record TemplateSummary(
        Long id,
        String name,
        String description,
        String category,
        String authorName,
        String updatedByName,
        int usageCount,
        double avgRating,
        int ratingCount,
        int myRating,
        Instant updatedAt) {}
