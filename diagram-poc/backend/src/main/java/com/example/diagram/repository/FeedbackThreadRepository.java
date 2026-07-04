package com.example.diagram.repository;

import com.example.diagram.domain.FeedbackThread;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeedbackThreadRepository extends JpaRepository<FeedbackThread, Long> {
    List<FeedbackThread> findByDiagramIdOrderByUpdatedAtDesc(Long diagramId);
}
