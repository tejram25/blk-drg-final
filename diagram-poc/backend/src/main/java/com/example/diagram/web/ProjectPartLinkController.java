package com.example.diagram.web;

import com.example.diagram.service.ProjectPartLinkService;
import com.example.diagram.web.dto.ProjectPartLinkDto;
import com.example.diagram.web.dto.ProjectPartLinkRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Parts linked to a project — the project's Bill of materials, persisted so it
 * survives a refresh. Thin: delegates to the service layer.
 */
@RestController
@RequestMapping("/api/workspace/projects/{projectId}/parts")
public class ProjectPartLinkController {

    private final ProjectPartLinkService links;

    public ProjectPartLinkController(ProjectPartLinkService links) {
        this.links = links;
    }

    @GetMapping
    public List<ProjectPartLinkDto> list(@PathVariable String projectId) {
        return links.list(projectId);
    }

    /** Link a part, or update its quantity if already linked. 201 with the stored link. */
    @PostMapping
    public ResponseEntity<ProjectPartLinkDto> link(@PathVariable String projectId,
                                                   @RequestBody ProjectPartLinkRequest request,
                                                   Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(links.link(projectId, request, emailOf(auth)));
    }

    @DeleteMapping("/{partId}")
    public ResponseEntity<Void> unlink(@PathVariable String projectId, @PathVariable String partId) {
        links.unlink(projectId, partId);
        return ResponseEntity.noContent().build();
    }

    private String emailOf(Authentication auth) {
        return auth == null ? "anonymous" : auth.getName();
    }
}
