package com.example.diagram.service;

import com.example.diagram.domain.ProjectFile;
import com.example.diagram.web.dto.FetchFileRequest;
import com.example.diagram.web.dto.ProjectFileDto;

import java.util.List;
import java.util.Optional;

/**
 * Files stored against a project. A datasheet linked from the Parts tab is
 * downloaded once and kept here, so the workspace serves its own copy rather
 * than sending the user off to another site.
 */
public interface ProjectFileService {

    List<ProjectFileDto> list(String projectId);

    /**
     * Download {@code url} and store it against the project (or return the
     * existing copy if that source was already fetched). Throws
     * IllegalArgumentException on a bad request and ResponseStatusException(502)
     * if the source cannot be fetched.
     */
    ProjectFileDto fetch(String projectId, FetchFileRequest request, String userEmail);

    /** The stored file (bytes + metadata) for download, if it exists. */
    Optional<ProjectFile> content(String projectId, Long fileId);

    void delete(String projectId, Long fileId);
}
