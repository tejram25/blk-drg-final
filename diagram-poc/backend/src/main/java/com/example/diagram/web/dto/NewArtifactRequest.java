package com.example.diagram.web.dto;

/**
 * Metadata for creating a workspace artefact. Sent as the JSON {@code metadata}
 * part of a multipart upload alongside the {@code file} part (see the artefact
 * controller). {@code folder} may be omitted — the server derives it from the
 * kind (e.g. dataset → Datasets).
 *
 * <p>Only {@code workspace}-origin artefacts can be created; there is no way to
 * inject a {@code salesforce}-origin artefact through the API — those arrive
 * only via the nightly sync.
 */
public record NewArtifactRequest(
        String name,
        String kind,
        String folder) {}
