package com.example.diagram.web.dto;

import java.util.List;

public record DesignReviewResult(
        List<ReviewFinding> findings,
        String model,
        boolean aiGenerated,
        String note) {}
