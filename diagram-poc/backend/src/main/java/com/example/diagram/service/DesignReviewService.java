package com.example.diagram.service;

import com.example.diagram.web.dto.DesignReviewRequest;
import com.example.diagram.web.dto.DesignReviewResult;

/**
 * Reviews a block diagram for architectural gaps, missing supporting components
 * and risks. Uses the local model when available, with deterministic heuristics
 * as a fallback and supplement so a review always returns something useful.
 */
public interface DesignReviewService {

    DesignReviewResult review(DesignReviewRequest request);
}
