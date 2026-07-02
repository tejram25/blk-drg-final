package com.example.diagram.service;

import com.example.diagram.web.dto.BoxSuggestionResult;

/** Suggests the component a diagram box needs, grounded in the live catalogue + Design Win POS. */
public interface BoxSuggestionService {
    BoxSuggestionResult suggest(String label, String sub, String kind);
}
