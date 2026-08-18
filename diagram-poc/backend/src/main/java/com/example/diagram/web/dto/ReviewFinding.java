package com.example.diagram.web.dto;

/**
 * One design-review finding.
 * {@code severity} ∈ risk|warn|info; {@code category} groups it (e.g. Power,
 * Protection, Connectivity); {@code suggestion} is the concrete fix.
 */
public record ReviewFinding(
        String severity,
        String category,
        String title,
        String detail,
        String suggestion) {}
