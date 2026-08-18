package com.example.diagram.web;

import com.example.diagram.service.BlockCatalogService;
import com.example.diagram.service.DiagramService;
import com.example.diagram.web.dto.DiagramRequest;
import com.example.diagram.web.dto.DiagramResponse;
import com.example.diagram.web.dto.DiagramSummary;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Diagram CRUD and the block palette. Thin: delegates to the service layer. */
@RestController
@RequestMapping("/api")
public class DiagramController {

    private final DiagramService diagrams;
    private final BlockCatalogService blocks;

    public DiagramController(DiagramService diagrams, BlockCatalogService blocks) {
        this.diagrams = diagrams;
        this.blocks = blocks;
    }

    @GetMapping("/diagrams")
    public List<DiagramSummary> list(Authentication auth) {
        return diagrams.listAll(emailOf(auth));
    }

    @GetMapping("/diagrams/{id}")
    public DiagramResponse get(@PathVariable Long id, Authentication auth) {
        return diagrams.get(id, emailOf(auth));
    }

    @PostMapping("/diagrams")
    public ResponseEntity<DiagramResponse> create(@RequestBody DiagramRequest request,
                                                  Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(diagrams.create(request, emailOf(auth)));
    }

    @PutMapping("/diagrams/{id}")
    public DiagramResponse update(@PathVariable Long id, @RequestBody DiagramRequest request,
                                  Authentication auth) {
        return diagrams.update(id, request, emailOf(auth));
    }

    @DeleteMapping("/diagrams/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        diagrams.delete(id, emailOf(auth));
        return ResponseEntity.noContent().build();
    }

    private String emailOf(Authentication auth) {
        return auth == null ? "anonymous" : auth.getName();
    }

    @GetMapping("/block-types")
    public List<Map<String, String>> blockTypes() {
        return blocks.blockTypes();
    }
}
