package com.example.diagram.web.dto;

import java.time.Instant;

public record FeedbackResponse(Long id, String category, int rating, String message,
                               String userEmail, Long diagramId, Instant createdAt) {
}
