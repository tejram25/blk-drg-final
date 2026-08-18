package com.example.diagram.web;

import com.example.diagram.service.WorkspaceProjectService;
import com.example.diagram.web.dto.Page;
import com.example.diagram.web.dto.SyncRun;
import com.example.diagram.web.dto.SyncStatus;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Salesforce → workspace project mirror. A nightly job is the normal path;
 * these endpoints expose its state, a manual override, and the run history shown
 * in the IDE status bar. Thin: delegates to the service layer.
 */
@RestController
@RequestMapping("/api/workspace/sync")
public class WorkspaceSyncController {

    private final WorkspaceProjectService workspace;

    public WorkspaceSyncController(WorkspaceProjectService workspace) {
        this.workspace = workspace;
    }

    /** Current mirror state: last/next run, counts, running flag. */
    @GetMapping("/status")
    public SyncStatus status() {
        return workspace.syncStatus();
    }

    /**
     * Kick a manual sync now. 202 Accepted — the run may still be in flight when
     * this returns. Idempotent while a run is already running.
     */
    @PostMapping("/run")
    public ResponseEntity<SyncRun> run(Authentication auth) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(workspace.runSync(emailOf(auth)));
    }

    /** Recent sync runs, newest first. */
    @GetMapping("/history")
    public Page<SyncRun> history(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return workspace.syncHistory(page, Math.max(1, Math.min(size, 100)));
    }

    private String emailOf(Authentication auth) {
        return auth == null ? "anonymous" : auth.getName();
    }
}
