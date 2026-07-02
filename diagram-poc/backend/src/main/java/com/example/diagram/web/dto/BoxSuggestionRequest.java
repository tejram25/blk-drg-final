package com.example.diagram.web.dto;

/** A single diagram box to find a component for. */
public record BoxSuggestionRequest(String label, String sub, String kind) {
}
