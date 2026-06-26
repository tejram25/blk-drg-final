package com.example.diagram.service.impl;

import com.example.diagram.domain.Diagram;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.service.AuditService;
import com.example.diagram.service.DiagramService;
import com.example.diagram.web.dto.DiagramRequest;
import com.example.diagram.web.dto.DiagramResponse;
import com.example.diagram.web.dto.DiagramSummary;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
public class DiagramServiceImpl implements DiagramService {

    private static final Set<String> LEVELS = Set.of("PUBLIC", "INTERNAL", "RESTRICTED");

    private final DiagramRepository repository;
    private final AuditService audit;

    public DiagramServiceImpl(DiagramRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    @Override
    public List<DiagramSummary> listAll(String viewerEmail) {
        return repository.findAll().stream()
                .filter(d -> canView(d, viewerEmail))
                .map(d -> new DiagramSummary(d.getId(), d.getName(), d.getClassification(),
                        d.getOwnerEmail(), d.getUpdatedAt()))
                .toList();
    }

    @Override
    public DiagramResponse get(Long id, String viewerEmail) {
        Diagram d = require(id);
        if (!canView(d, viewerEmail)) {
            throw new NotFoundException("Diagram not found"); // hide existence of restricted files
        }
        audit.record("diagram.open", viewerEmail, d.getId(), d.getClassification());
        return toResponse(d);
    }

    @Override
    public DiagramResponse create(DiagramRequest request, String ownerEmail) {
        Diagram diagram = new Diagram();
        diagram.setName(request.name());
        diagram.setContentJson(request.contentJson());
        diagram.setClassification(level(request.classification()));
        diagram.setOwnerEmail(ownerEmail);
        Diagram saved = repository.save(diagram);
        audit.record("diagram.create", ownerEmail, saved.getId(), saved.getClassification());
        return toResponse(saved);
    }

    @Override
    public DiagramResponse update(Long id, DiagramRequest request, String viewerEmail) {
        Diagram diagram = require(id);
        if (!canView(diagram, viewerEmail)) {
            throw new NotFoundException("Diagram not found");
        }
        diagram.setName(request.name());
        diagram.setContentJson(request.contentJson());
        if (request.classification() != null) {
            diagram.setClassification(level(request.classification()));
        }
        if (diagram.getOwnerEmail() == null) {
            diagram.setOwnerEmail(viewerEmail); // adopt ownership of legacy diagrams
        }
        Diagram saved = repository.save(diagram);
        audit.record("diagram.save", viewerEmail, saved.getId(), saved.getClassification());
        return toResponse(saved);
    }

    @Override
    public void delete(Long id, String viewerEmail) {
        Diagram d = repository.findById(id).orElse(null);
        if (d == null) return;
        if (!canView(d, viewerEmail)) {
            throw new AccessDeniedException("Not allowed to delete this diagram");
        }
        audit.record("diagram.delete", viewerEmail, id, d.getClassification());
        repository.deleteById(id);
    }

    // --- access control ---

    /** A RESTRICTED diagram is visible only to its owner; others are open. */
    private boolean canView(Diagram d, String viewerEmail) {
        if (!"RESTRICTED".equals(d.getClassification())) return true;
        return d.getOwnerEmail() == null || d.getOwnerEmail().equalsIgnoreCase(viewerEmail);
    }

    private String level(String raw) {
        if (raw == null) return "INTERNAL";
        String up = raw.trim().toUpperCase();
        return LEVELS.contains(up) ? up : "INTERNAL";
    }

    private Diagram require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Diagram not found"));
    }

    private DiagramResponse toResponse(Diagram d) {
        return new DiagramResponse(d.getId(), d.getName(), d.getContentJson(),
                d.getClassification(), d.getOwnerEmail(), d.getUpdatedAt());
    }
}
