package com.example.diagram.web.dto;

import java.util.List;

/**
 * A tabular sample of a {@code dataset} artefact: the column headers and the
 * first handful of rows. Cells are strings or numbers, so the value type is
 * {@code Object} and serialises as-is. This is a preview only — the full file is
 * fetched from the artefact content endpoint.
 */
public record DatasetPreview(
        List<String> columns,
        List<List<Object>> rows) {}
