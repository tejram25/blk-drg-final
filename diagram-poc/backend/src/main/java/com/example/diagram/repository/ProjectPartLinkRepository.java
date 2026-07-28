package com.example.diagram.repository;

import com.example.diagram.domain.ProjectPartLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectPartLinkRepository extends JpaRepository<ProjectPartLink, Long> {

    List<ProjectPartLink> findByProjectIdOrderByPartNumberAsc(String projectId);

    Optional<ProjectPartLink> findByProjectIdAndPartId(String projectId, String partId);

    void deleteByProjectIdAndPartId(String projectId, String partId);
}
