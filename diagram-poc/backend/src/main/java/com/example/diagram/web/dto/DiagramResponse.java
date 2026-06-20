package com.example.diagram.web.dto;

import java.time.Instant;

/** Full diagram payload returned to the client. */
public record DiagramResponse(Long id, String name, String contentJson, Instant updatedAt) {}
