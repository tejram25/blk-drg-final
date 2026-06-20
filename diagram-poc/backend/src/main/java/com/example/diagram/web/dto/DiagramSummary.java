package com.example.diagram.web.dto;

import java.time.Instant;

/** Lightweight diagram listing (no heavy contentJson). */
public record DiagramSummary(Long id, String name, Instant updatedAt) {}
