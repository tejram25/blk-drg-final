package com.example.diagram.web;

import com.example.diagram.service.FeedbackLoopService;
import com.example.diagram.web.dto.FeedbackLoopDtos.BoardDto;
import com.example.diagram.web.dto.FeedbackLoopDtos.NewEntryRequest;
import com.example.diagram.web.dto.FeedbackLoopDtos.NewThreadRequest;
import com.example.diagram.web.dto.FeedbackLoopDtos.ThreadDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Feedback loop endpoints. The author is always taken from the session; the
 * role is a free-form tag chosen by the author (dynamic actors, no fixed enum).
 */
@RestController
@RequestMapping("/api")
public class FeedbackLoopController {

    private final FeedbackLoopService service;

    public FeedbackLoopController(FeedbackLoopService service) {
        this.service = service;
    }

    @GetMapping("/diagrams/{id}/feedback-loop")
    public BoardDto board(@PathVariable Long id, Authentication auth) {
        return service.board(id, auth == null ? null : auth.getName());
    }

    @PostMapping("/diagrams/{id}/feedback-loop")
    public ResponseEntity<ThreadDto> create(@PathVariable Long id,
                                            @RequestBody NewThreadRequest req,
                                            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createThread(id, req, auth.getName()));
    }

    @PostMapping("/feedback-loop/{threadId}/entries")
    public ThreadDto reply(@PathVariable Long threadId,
                           @RequestBody NewEntryRequest req,
                           Authentication auth) {
        return service.addEntry(threadId, req, auth.getName());
    }
}
