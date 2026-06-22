package com.example.diagram.web.dto;

import java.time.Instant;

/** Full template including its diagram content, returned on get/use/create/update. */
public record TemplateDetail(
        Long id,
        String name,
        String description,
        String category,
        String contentJson,
        String authorName,
        String updatedByName,
        int usageCount,
        double avgRating,
        int ratingCount,
        int myRating,
        Instant createdAt,
        Instant updatedAt) {}
