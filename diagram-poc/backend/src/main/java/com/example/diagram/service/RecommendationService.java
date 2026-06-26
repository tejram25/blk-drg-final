package com.example.diagram.service;

import com.example.diagram.web.dto.RecommendationRequest;
import com.example.diagram.web.dto.RecommendationResult;

/**
 * Recommends templates, parts and solution options with source traceability and
 * prompts to verify specs/datasheets. Backed by Claude when an API key is
 * configured, and by a deterministic rule-based engine otherwise.
 */
public interface RecommendationService {
    RecommendationResult recommend(RecommendationRequest request);
}
