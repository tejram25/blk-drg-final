package com.example.diagram.web.dto;

import java.time.Instant;

/** A comment in the list view. {@code self} flags the caller's own comment. */
public record CommentResponse(
        Long id, String nodeId, String authorName, String text, Instant createdAt, boolean self) {}
