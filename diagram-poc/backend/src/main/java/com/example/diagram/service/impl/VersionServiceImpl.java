package com.example.diagram.service.impl;

import com.example.diagram.domain.DiagramVersion;
import com.example.diagram.domain.User;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.DiagramVersionRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.service.VersionService;
import com.example.diagram.web.dto.VersionDetail;
import com.example.diagram.web.dto.VersionRequest;
import com.example.diagram.web.dto.VersionSummary;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VersionServiceImpl implements VersionService {

    private final DiagramVersionRepository versions;
    private final DiagramRepository diagrams;
    private final UserRepository users;

    public VersionServiceImpl(DiagramVersionRepository versions, DiagramRepository diagrams, UserRepository users) {
        this.versions = versions;
        this.diagrams = diagrams;
        this.users = users;
    }

    @Override
    public VersionSummary snapshot(Long diagramId, VersionRequest request, String userEmail) {
        if (!diagrams.existsById(diagramId)) {
            throw new NotFoundException("Diagram not found");
        }
        DiagramVersion version = new DiagramVersion();
        version.setDiagramId(diagramId);
        String label = request.label() == null ? "" : request.label().trim();
        version.setLabel(label.isEmpty() ? "Snapshot" : label);
        version.setContentJson(request.contentJson());
        version.setAuthorEmail(userEmail);
        version.setAuthorName(displayName(userEmail));
        DiagramVersion saved = versions.save(version);
        return toSummary(saved);
    }

    @Override
    public List<VersionSummary> list(Long diagramId) {
        return versions.findByDiagramIdOrderByCreatedAtDesc(diagramId).stream()
                .map(this::toSummary)
                .toList();
    }

    @Override
    public VersionDetail get(Long versionId) {
        DiagramVersion v = versions.findById(versionId)
                .orElseThrow(() -> new NotFoundException("Version not found"));
        return new VersionDetail(v.getId(), v.getLabel(), v.getContentJson(), v.getAuthorName(), v.getCreatedAt());
    }

    private VersionSummary toSummary(DiagramVersion v) {
        return new VersionSummary(v.getId(), v.getLabel(), v.getAuthorName(), v.getCreatedAt());
    }

    private String displayName(String email) {
        return users.findByEmail(email)
                .map(User::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElse(email);
    }
}
