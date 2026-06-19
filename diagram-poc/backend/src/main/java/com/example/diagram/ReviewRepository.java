package com.example.diagram;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByDiagramIdOrderByUpdatedAtDesc(Long diagramId);
    Optional<Review> findByDiagramIdAndUserEmail(Long diagramId, String userEmail);
}
