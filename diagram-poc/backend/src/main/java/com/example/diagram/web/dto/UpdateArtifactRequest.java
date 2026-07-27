package com.example.diagram.web.dto;

/**
 * Editable metadata for a workspace artefact (rename, re-file). Null fields are
 * left unchanged. Rejected with 403 for {@code salesforce}-origin artefacts,
 * which are read-only mirrors.
 */
public record UpdateArtifactRequest(
        String name,
        String folder) {}
