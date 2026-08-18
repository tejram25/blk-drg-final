package com.example.diagram.web;

import com.example.diagram.service.CommentService;
import com.example.diagram.web.dto.CommentRequest;
import com.example.diagram.web.dto.CommentResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Comment endpoints for diagrams. The author is taken from the session. */
@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentService comments;

    public CommentController(CommentService comments) {
        this.comments = comments;
    }

    @GetMapping("/diagrams/{id}/comments")
    public List<CommentResponse> list(@PathVariable Long id, Authentication auth) {
        return comments.list(id, auth == null ? null : auth.getName());
    }

    @PostMapping("/diagrams/{id}/comments")
    public ResponseEntity<CommentResponse> add(@PathVariable Long id,
                                               @RequestBody CommentRequest request,
                                               Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(comments.add(id, request, auth.getName()));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> delete(@PathVariable Long commentId, Authentication auth) {
        comments.delete(commentId, auth.getName());
        return ResponseEntity.noContent().build();
    }
}
