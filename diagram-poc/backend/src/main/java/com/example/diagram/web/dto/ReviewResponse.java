package com.example.diagram.web.dto;

import java.util.List;
import java.util.Map;

/**
 * Aggregate review data for one diagram: the average, count, star distribution,
 * the caller's own review (or null) and the full list.
 */
public record ReviewResponse(
        double average,
        int count,
        Map<String, Integer> distribution,
        Mine mine,
        List<ReviewItemDto> reviews) {

    /** The caller's own review, used to pre-fill the rate form. */
    public record Mine(int rating, String comment) {}
}
