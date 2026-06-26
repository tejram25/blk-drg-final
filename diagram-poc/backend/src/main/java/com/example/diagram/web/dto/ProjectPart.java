package com.example.diagram.web.dto;

/** A line item pulled from an internal project's BOM. */
public record ProjectPart(
        String partNumber,
        String manufacturer,
        String description,
        int quantity,
        int leadTimeWeeks,
        String lifecycle) {}
