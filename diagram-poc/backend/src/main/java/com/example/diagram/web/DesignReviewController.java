package com.example.diagram.web;

import com.example.diagram.service.DesignReviewService;
import com.example.diagram.web.dto.DesignReviewRequest;
import com.example.diagram.web.dto.DesignReviewResult;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** AI (+ rule-based) design review of a block diagram. */
@RestController
@RequestMapping("/api")
public class DesignReviewController {

    private final DesignReviewService reviews;

    public DesignReviewController(DesignReviewService reviews) {
        this.reviews = reviews;
    }

    @PostMapping("/design-review")
    public DesignReviewResult review(@RequestBody DesignReviewRequest request) {
        return reviews.review(request);
    }
}
