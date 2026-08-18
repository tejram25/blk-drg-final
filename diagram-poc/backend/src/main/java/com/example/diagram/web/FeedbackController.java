package com.example.diagram.web;

import com.example.diagram.service.FeedbackService;
import com.example.diagram.web.dto.FeedbackRequest;
import com.example.diagram.web.dto.FeedbackResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Feedback loop: submit and review user feedback. */
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedback;

    public FeedbackController(FeedbackService feedback) {
        this.feedback = feedback;
    }

    @PostMapping
    public ResponseEntity<FeedbackResponse> submit(@RequestBody FeedbackRequest request,
                                                   Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(feedback.submit(request, emailOf(auth)));
    }

    @GetMapping
    public List<FeedbackResponse> list() {
        return feedback.list();
    }

    private String emailOf(Authentication auth) {
        return auth == null ? "anonymous" : auth.getName();
    }
}
