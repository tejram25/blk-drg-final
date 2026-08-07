package com.arrow.dws.domain.model;

/** A supplier working on the design, and where that has got to. */
public record SupplierEngagement(
        String name,
        String role,
        WorkStatus status,
        String latestNote) {
}
