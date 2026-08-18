package com.example.diagram.web.dto;

/** Payload for submitting a piece of feedback. */
public record FeedbackRequest(String category, int rating, String message, Long diagramId) {
}
