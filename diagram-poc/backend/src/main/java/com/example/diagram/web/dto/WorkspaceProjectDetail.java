package com.example.diagram.web.dto;

import java.time.Instant;
import java.util.List;

/**
 * A project opened in the IDE: the summary fields plus the flat list of its
 * artefacts. The client groups artefacts into folders (Diagrams, Documents,
 * Datasets, Bill of materials, Reviews) for the tree, so the server returns them
 * flat and lets the UI own folder ordering.
 *
 * <p>Only the open project's artefacts are ever loaded — the catalogue is far
 * too large to send eagerly.
 */
public record WorkspaceProjectDetail(
        String id,
        String sfdcId,
        String name,
        String customer,
        String category,
        String stage,
        long value,
        String owner,
        String health,
        Instant updatedAt,
        int diagrams,
        int parts,
        List<ArtifactSummary> artifacts) {}
