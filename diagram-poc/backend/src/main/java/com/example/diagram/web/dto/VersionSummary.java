package com.example.diagram.web.dto;

import java.time.Instant;

/** Version list entry (no heavy contentJson). */
public record VersionSummary(Long id, String label, String authorName, Instant createdAt) {}
