package com.example.diagram.service;

import com.example.diagram.web.dto.ArtifactDetail;
import com.example.diagram.web.dto.ArtifactSummary;
import com.example.diagram.web.dto.NewArtifactRequest;
import com.example.diagram.web.dto.Page;
import com.example.diagram.web.dto.SyncRun;
import com.example.diagram.web.dto.SyncStatus;
import com.example.diagram.web.dto.UpdateArtifactRequest;
import com.example.diagram.web.dto.WorkspaceProjectDetail;
import com.example.diagram.web.dto.WorkspaceProjectSummary;

import java.util.List;

/**
 * The IDE workspace backend: Salesforce-mirrored projects, the engineering
 * artefacts hung off them, and the state of the mirror itself.
 *
 * <p>Controllers depend on this abstraction only. The current implementation is
 * mock-backed (so the IDE runs offline); a real one would read projects from the
 * Salesforce nightly mirror and artefacts from workspace storage, without
 * touching callers (DIP/OCP) — mirroring how {@link IntegrationService} is
 * swapped for a live client.
 *
 * <p><b>Provenance is enforced here, not in the controller.</b> Artefacts with
 * {@code origin = salesforce} are read-only mirrors; {@link #updateArtifact} and
 * {@link #deleteArtifact} throw {@link org.springframework.security.access.AccessDeniedException}
 * for them, which the global handler maps to 403.
 */
public interface WorkspaceProjectService {

    // ---- projects ----------------------------------------------------------

    /**
     * One page of the project catalogue, filtered and searched. All filters are
     * optional (null/blank = no constraint). {@code q} matches name, customer,
     * id, Salesforce id and owner. Ordered most-recently-updated first.
     */
    Page<WorkspaceProjectSummary> searchProjects(
            String q, String stage, String health, String owner, int page, int size);

    /** A project with its artefacts, or throws {@link com.example.diagram.web.error.NotFoundException}. */
    WorkspaceProjectDetail getProject(String projectId);

    // ---- artefacts ---------------------------------------------------------

    /** The artefacts of a project (flat; the client groups them into folders). */
    List<ArtifactSummary> listArtifacts(String projectId);

    /** A single artefact with its preview/summary body. */
    ArtifactDetail getArtifact(String projectId, String artifactId);

    /** The raw bytes of a file-backed artefact, for download. */
    byte[] getArtifactContent(String projectId, String artifactId);

    /**
     * Create a workspace artefact from an upload. Always {@code origin =
     * workspace}. {@code content} may be empty for generated kinds (e.g. bom).
     */
    ArtifactSummary createArtifact(
            String projectId, NewArtifactRequest request, byte[] content, String authorEmail);

    /** Rename / re-file a workspace artefact. 403 for salesforce-origin artefacts. */
    ArtifactSummary updateArtifact(
            String projectId, String artifactId, UpdateArtifactRequest request);

    /** Delete a workspace artefact. 403 for salesforce-origin artefacts. */
    void deleteArtifact(String projectId, String artifactId);

    // ---- sync --------------------------------------------------------------

    /** Current state of the Salesforce project mirror. */
    SyncStatus syncStatus();

    /**
     * Kick a manual sync now (the nightly job is the normal path). Returns the
     * run that was started. Idempotent while a run is already in flight — returns
     * the in-flight run rather than starting a second.
     */
    SyncRun runSync(String triggeredByEmail);

    /** Recent sync runs, newest first. */
    Page<SyncRun> syncHistory(int page, int size);
}
