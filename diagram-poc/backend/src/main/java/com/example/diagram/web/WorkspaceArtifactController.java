package com.example.diagram.web;

import com.example.diagram.service.WorkspaceProjectService;
import com.example.diagram.web.dto.ArtifactDetail;
import com.example.diagram.web.dto.ArtifactSummary;
import com.example.diagram.web.dto.NewArtifactRequest;
import com.example.diagram.web.dto.UpdateArtifactRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * Engineering artefacts hung off a project — diagrams, documents, datasets, BOM,
 * reviews.
 *
 * <p>Provenance governs writes: {@code salesforce}-origin artefacts are
 * read-only mirrors and reject create-into/update/delete with 403 (enforced in
 * the service, mapped by the global handler). Only {@code workspace}-origin
 * artefacts are editable. Thin: delegates to the service layer.
 */
@RestController
@RequestMapping("/api/workspace")
public class WorkspaceArtifactController {

    private final WorkspaceProjectService workspace;

    public WorkspaceArtifactController(WorkspaceProjectService workspace) {
        this.workspace = workspace;
    }

    /** All artefacts of a project (flat; the client groups them into folders). */
    @GetMapping("/projects/{projectId}/artifacts")
    public List<ArtifactSummary> list(@PathVariable String projectId) {
        return workspace.listArtifacts(projectId);
    }

    /** A single artefact with its preview/summary body. 404 if unknown. */
    @GetMapping("/projects/{projectId}/artifacts/{artifactId}")
    public ArtifactDetail get(@PathVariable String projectId, @PathVariable String artifactId) {
        return workspace.getArtifact(projectId, artifactId);
    }

    /** The raw bytes of a file-backed artefact, as a download. */
    @GetMapping("/projects/{projectId}/artifacts/{artifactId}/content")
    public ResponseEntity<byte[]> download(
            @PathVariable String projectId, @PathVariable String artifactId) {
        ArtifactDetail meta = workspace.getArtifact(projectId, artifactId);
        byte[] body = workspace.getArtifactContent(projectId, artifactId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + meta.name() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(body);
    }

    /**
     * Create a workspace artefact from a multipart upload: a {@code metadata}
     * JSON part plus an optional {@code file} part. Always {@code origin =
     * workspace}. 201 with the created summary.
     */
    @PostMapping("/projects/{projectId}/artifacts")
    public ResponseEntity<ArtifactSummary> create(
            @PathVariable String projectId,
            @RequestPart("metadata") NewArtifactRequest metadata,
            @RequestPart(value = "file", required = false) MultipartFile file,
            Authentication auth) {
        byte[] content = readBytes(file);
        ArtifactSummary created = workspace.createArtifact(projectId, metadata, content, emailOf(auth));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** Rename / re-file a workspace artefact. 403 for salesforce-origin artefacts. */
    @PutMapping("/projects/{projectId}/artifacts/{artifactId}")
    public ArtifactSummary update(
            @PathVariable String projectId, @PathVariable String artifactId,
            @RequestBody UpdateArtifactRequest request) {
        return workspace.updateArtifact(projectId, artifactId, request);
    }

    /** Delete a workspace artefact. 403 for salesforce-origin artefacts. */
    @DeleteMapping("/projects/{projectId}/artifacts/{artifactId}")
    public ResponseEntity<Void> delete(
            @PathVariable String projectId, @PathVariable String artifactId) {
        workspace.deleteArtifact(projectId, artifactId);
        return ResponseEntity.noContent().build();
    }

    private static byte[] readBytes(MultipartFile file) {
        if (file == null || file.isEmpty()) return null;
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read uploaded file", e);
        }
    }

    private String emailOf(Authentication auth) {
        return auth == null ? "anonymous" : auth.getName();
    }
}
