package com.example.diagram.service;

import com.example.diagram.web.dto.ProjectPartLinkDto;
import com.example.diagram.web.dto.ProjectPartLinkRequest;

import java.util.List;

/**
 * Persists the parts linked to a project — the project's Bill of materials.
 *
 * <p>These outlive a browser refresh, unlike the in-memory demo state they
 * replace. Backed by a table (see {@code ProjectPartLink}); the interface keeps
 * the controller thin and the store swappable.
 */
public interface ProjectPartLinkService {

    /** Parts linked to a project, ordered by part number. */
    List<ProjectPartLinkDto> list(String projectId);

    /**
     * Link a part to a project, or update its quantity if already linked
     * (idempotent per {@code partId}). Returns the stored link.
     */
    ProjectPartLinkDto link(String projectId, ProjectPartLinkRequest request, String userEmail);

    /** Remove a linked part. No-op if it was not linked. */
    void unlink(String projectId, String partId);
}
