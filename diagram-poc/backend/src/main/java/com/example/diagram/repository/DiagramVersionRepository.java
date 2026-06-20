package com.example.diagram.repository;

import com.example.diagram.domain.DiagramVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DiagramVersionRepository extends JpaRepository<DiagramVersion, Long> {
    List<DiagramVersion> findByDiagramIdOrderByCreatedAtDesc(Long diagramId);
}
