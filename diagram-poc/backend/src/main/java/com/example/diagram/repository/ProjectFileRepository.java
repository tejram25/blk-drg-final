package com.example.diagram.repository;

import com.example.diagram.domain.ProjectFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {
    List<ProjectFile> findByProjectIdOrderByNameAsc(String projectId);
    Optional<ProjectFile> findByProjectIdAndSourceUrl(String projectId, String sourceUrl);
    Optional<ProjectFile> findByIdAndProjectId(Long id, String projectId);
}
