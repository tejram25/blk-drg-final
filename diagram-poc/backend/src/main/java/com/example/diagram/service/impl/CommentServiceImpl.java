package com.example.diagram.service.impl;

import com.example.diagram.domain.Comment;
import com.example.diagram.domain.User;
import com.example.diagram.repository.CommentRepository;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.service.CommentService;
import com.example.diagram.web.dto.CommentRequest;
import com.example.diagram.web.dto.CommentResponse;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CommentServiceImpl implements CommentService {

    private static final int MAX_TEXT_LENGTH = 2000;

    private final CommentRepository comments;
    private final DiagramRepository diagrams;
    private final UserRepository users;

    public CommentServiceImpl(CommentRepository comments, DiagramRepository diagrams, UserRepository users) {
        this.comments = comments;
        this.diagrams = diagrams;
        this.users = users;
    }

    @Override
    public List<CommentResponse> list(Long diagramId, String userEmail) {
        return comments.findByDiagramIdOrderByCreatedAtAsc(diagramId).stream()
                .map(c -> toResponse(c, userEmail))
                .toList();
    }

    @Override
    public CommentResponse add(Long diagramId, CommentRequest request, String userEmail) {
        if (!diagrams.existsById(diagramId)) {
            throw new NotFoundException("Diagram not found");
        }
        String text = request.text() == null ? "" : request.text().trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("Comment cannot be empty");
        }
        Comment comment = new Comment();
        comment.setDiagramId(diagramId);
        comment.setNodeId(request.nodeId());
        comment.setText(text.length() > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text);
        comment.setAuthorEmail(userEmail);
        comment.setAuthorName(displayName(userEmail));
        return toResponse(comments.save(comment), userEmail);
    }

    @Override
    public void delete(Long commentId, String userEmail) {
        Comment comment = comments.findById(commentId)
                .orElseThrow(() -> new NotFoundException("Comment not found"));
        if (!comment.getAuthorEmail().equals(userEmail)) {
            throw new IllegalArgumentException("You can only delete your own comments");
        }
        comments.delete(comment);
    }

    private CommentResponse toResponse(Comment c, String userEmail) {
        boolean self = userEmail != null && userEmail.equals(c.getAuthorEmail());
        return new CommentResponse(c.getId(), c.getNodeId(), c.getAuthorName(), c.getText(), c.getCreatedAt(), self);
    }

    private String displayName(String email) {
        return users.findByEmail(email)
                .map(User::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElse(email);
    }
}
