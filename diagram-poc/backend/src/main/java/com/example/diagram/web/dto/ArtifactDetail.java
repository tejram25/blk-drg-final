package com.example.diagram.web.dto;

import java.time.Instant;

/**
 * A single artefact with enough body to render it in the viewer without a
 * separate download:
 * <ul>
 *   <li>{@code preview} — a small tabular sample for {@code dataset} artefacts
 *       (the first rows; the full file is fetched via the content endpoint).</li>
 *   <li>{@code summary} — the human-readable body for {@code review} and
 *       {@code document} artefacts (findings, notes).</li>
 * </ul>
 * Both are null when not applicable to the kind. All the {@link ArtifactSummary}
 * metadata fields are repeated so the viewer needs only this one call.
 */
public record ArtifactDetail(
        String id,
        String name,
        String kind,
        String folder,
        Instant updatedAt,
        String author,
        Long size,
        Long diagramId,
        String origin,
        DatasetPreview preview,
        String summary) {}
