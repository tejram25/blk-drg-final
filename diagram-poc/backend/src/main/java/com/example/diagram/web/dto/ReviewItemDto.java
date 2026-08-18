package com.example.diagram.web.dto;

import java.time.Instant;

/** One review in the list view. {@code self} flags the caller's own review. */
public record ReviewItemDto(String userName, int rating, String comment, Instant updatedAt, boolean self) {}
