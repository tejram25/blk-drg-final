package com.example.diagram.repository;

import com.example.diagram.domain.Comment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByDiagramIdOrderByCreatedAtAsc(Long diagramId);
}
