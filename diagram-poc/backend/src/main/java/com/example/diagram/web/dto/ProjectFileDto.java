package com.example.diagram.web.dto;

/** A stored project file, as the UI lists it (metadata only; bytes via /content). */
public record ProjectFileDto(
        Long id,
        String name,
        String folder,
        String contentType,
        long sizeBytes,
        String sourceUrl,
        String linkedBy) {}
