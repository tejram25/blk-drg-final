package com.example.diagram.web.dto;

import java.util.List;

/** What the user is designing + the parts already on the canvas. */
public record RecommendationRequest(String goal, List<String> currentParts) {}
