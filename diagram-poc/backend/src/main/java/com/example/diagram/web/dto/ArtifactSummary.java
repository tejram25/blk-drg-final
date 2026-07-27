package com.example.diagram.web.dto;

import java.time.Instant;

/**
 * An artefact hanging off a project — the metadata shown in the project tree and
 * editor tabs, without its body.
 *
 * <p>{@code kind} is one of diagram, document, dataset, bom, review. {@code
 * folder} is the tree group it belongs under.
 *
 * <p>{@code origin} is the provenance and the authority for write access:
 * <ul>
 *   <li>{@code salesforce} — mirrored from the system of record, read-only here.
 *       Update/delete return 403.</li>
 *   <li>{@code workspace} — created in this workspace, fully editable.</li>
 * </ul>
 *
 * <p>{@code size} is bytes for file-backed artefacts (null for generated ones
 * like a BOM). {@code diagramId} links a {@code diagram} artefact to the GoJS
 * editor's diagram record (null for other kinds).
 */
public record ArtifactSummary(
        String id,
        String name,
        String kind,
        String folder,
        Instant updatedAt,
        String author,
        Long size,
        Long diagramId,
        String origin) {}
