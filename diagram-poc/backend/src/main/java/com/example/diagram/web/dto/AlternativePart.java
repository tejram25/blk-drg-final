package com.example.diagram.web.dto;

/** A practical alternative for a part. {@code dropIn} = pin/spec compatible. */
public record AlternativePart(
        String partNumber,
        String manufacturer,
        String note,
        boolean dropIn) {}
