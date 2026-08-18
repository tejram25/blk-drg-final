package com.example.diagram.web.dto;

import java.util.List;

/** Suggestions for a box, ranked most field-proven / in-stock first. */
public record BoxSuggestionResult(String query, List<BoxSuggestion> suggestions, String note) {
}
