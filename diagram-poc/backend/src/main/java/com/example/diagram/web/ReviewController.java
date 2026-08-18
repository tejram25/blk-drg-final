package com.example.diagram.web;

import com.example.diagram.service.ReviewService;
import com.example.diagram.web.dto.ReviewRequest;
import com.example.diagram.web.dto.ReviewResponse;
import com.example.diagram.web.dto.ReviewSummaryDto;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Reviews for saved diagrams. Thin: the reviewer is taken from the authenticated
 * session and passed to the service, never read from the request body.
 */
@RestController
@RequestMapping("/api")
public class ReviewController {

    private final ReviewService reviews;

    public ReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping("/diagrams/{id}/reviews")
    public ReviewResponse forDiagram(@PathVariable Long id, Authentication auth) {
        return reviews.getForDiagram(id, auth == null ? null : auth.getName());
    }

    @PostMapping("/diagrams/{id}/reviews")
    public ReviewResponse submit(@PathVariable Long id,
                                 @RequestBody ReviewRequest request,
                                 Authentication auth) {
        return reviews.submit(id, request, auth.getName());
    }

    @GetMapping("/reviews/summary")
    public List<ReviewSummaryDto> summary() {
        return reviews.summary();
    }
}
