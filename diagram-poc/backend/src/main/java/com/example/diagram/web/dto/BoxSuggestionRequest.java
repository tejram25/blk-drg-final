package com.example.diagram.web.dto;

/**
 * A diagram box to find a component for, optionally scoped to the Design Win
 * customer/project/board the diagram is attached to (so the customer's approved
 * parts can be preferred).
 */
public record BoxSuggestionRequest(
        String label, String sub, String kind,
        String customerName, String custBillTo, String projectId, String boardNum) {
}
