package com.example.diagram.web;

import com.example.diagram.service.VersionService;
import com.example.diagram.web.dto.VersionDetail;
import com.example.diagram.web.dto.VersionRequest;
import com.example.diagram.web.dto.VersionSummary;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Version-history endpoints for diagrams. */
@RestController
@RequestMapping("/api")
public class VersionController {

    private final VersionService versions;

    public VersionController(VersionService versions) {
        this.versions = versions;
    }

    @PostMapping("/diagrams/{id}/versions")
    public ResponseEntity<VersionSummary> snapshot(@PathVariable Long id,
                                                   @RequestBody VersionRequest request,
                                                   Authentication auth) {
        VersionSummary saved = versions.snapshot(id, request, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/diagrams/{id}/versions")
    public List<VersionSummary> list(@PathVariable Long id) {
        return versions.list(id);
    }

    @GetMapping("/versions/{versionId}")
    public VersionDetail get(@PathVariable Long versionId) {
        return versions.get(versionId);
    }
}
