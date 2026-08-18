package com.example.diagram.service;

import com.example.diagram.web.dto.CommentRequest;
import com.example.diagram.web.dto.CommentResponse;

import java.util.List;

/** Comments on diagrams (optionally pinned to a block). */
public interface CommentService {

    List<CommentResponse> list(Long diagramId, String userEmail);

    CommentResponse add(Long diagramId, CommentRequest request, String userEmail);

    void delete(Long commentId, String userEmail);
}
