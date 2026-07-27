package com.example.diagram.web;

import com.example.diagram.service.WorkspaceProjectService;
import com.example.diagram.web.dto.Page;
import com.example.diagram.web.dto.WorkspaceProjectDetail;
import com.example.diagram.web.dto.WorkspaceProjectSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Salesforce-mirrored projects. The catalogue runs to thousands of rows, so the
 * list is always paged and searched — never returned whole. Thin: delegates to
 * the service layer.
 */
@RestController
@RequestMapping("/api/workspace")
public class WorkspaceProjectController {

    private final WorkspaceProjectService workspace;

    public WorkspaceProjectController(WorkspaceProjectService workspace) {
        this.workspace = workspace;
    }

    /**
     * One page of the project catalogue. All filters optional. {@code q} matches
     * name, customer, id, Salesforce id and owner.
     */
    @GetMapping("/projects")
    public Page<WorkspaceProjectSummary> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String health,
            @RequestParam(required = false) String owner,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return workspace.searchProjects(q, stage, health, owner, page, clamp(size));
    }

    /** A project with its artefacts. 404 if unknown. */
    @GetMapping("/projects/{id}")
    public WorkspaceProjectDetail get(@PathVariable String id) {
        return workspace.getProject(id);
    }

    /** Guard the page size so a client can't ask for the whole catalogue at once. */
    private int clamp(int size) {
        return Math.max(1, Math.min(size, 100));
    }
}
