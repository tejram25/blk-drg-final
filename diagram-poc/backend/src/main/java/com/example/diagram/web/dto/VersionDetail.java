package com.example.diagram.web.dto;

import java.time.Instant;

/** Full version payload, including the snapshot content for restore. */
public record VersionDetail(Long id, String label, String contentJson, String authorName, Instant createdAt) {}
