package com.example.diagram.web;

import com.example.diagram.service.RecommendationService;
import com.example.diagram.web.dto.RecommendationRequest;
import com.example.diagram.web.dto.RecommendationResult;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** AI (Google Gemini) recommendations with rule-based fallback. */
@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationService recommendations;

    public RecommendationController(RecommendationService recommendations) {
        this.recommendations = recommendations;
    }

    @PostMapping
    public RecommendationResult recommend(@RequestBody RecommendationRequest request) {
        return recommendations.recommend(request);
    }
}
