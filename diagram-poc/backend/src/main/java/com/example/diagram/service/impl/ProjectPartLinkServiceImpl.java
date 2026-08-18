package com.example.diagram.service.impl;

import com.example.diagram.domain.ProjectPartLink;
import com.example.diagram.repository.ProjectPartLinkRepository;
import com.example.diagram.service.ProjectPartLinkService;
import com.example.diagram.web.dto.ProjectPartLinkDto;
import com.example.diagram.web.dto.ProjectPartLinkRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Table-backed part links. */
@Service
public class ProjectPartLinkServiceImpl implements ProjectPartLinkService {

    private final ProjectPartLinkRepository repo;

    public ProjectPartLinkServiceImpl(ProjectPartLinkRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProjectPartLinkDto> list(String projectId) {
        return repo.findByProjectIdOrderByPartNumberAsc(projectId).stream().map(this::toDto).toList();
    }

    @Override
    @Transactional
    public ProjectPartLinkDto link(String projectId, ProjectPartLinkRequest request, String userEmail) {
        if (request == null || request.partId() == null || request.partId().isBlank()) {
            throw new IllegalArgumentException("partId is required.");
        }
        // Re-linking the same part updates its quantity rather than duplicating.
        ProjectPartLink link = repo.findByProjectIdAndPartId(projectId, request.partId())
                .orElseGet(ProjectPartLink::new);
        link.setProjectId(projectId);
        link.setPartId(request.partId());
        link.setPartNumber(request.partNumber());
        link.setManufacturer(request.manufacturer());
        link.setDescription(request.description());
        link.setStatus(request.status());
        link.setUnitPrice(request.unitPrice());
        link.setCurrency(request.currency());
        link.setQuantity(Math.max(1, request.quantity()));
        link.setPartJson(request.part());
        if (link.getLinkedBy() == null) link.setLinkedBy(userEmail);
        return toDto(repo.save(link));
    }

    @Override
    @Transactional
    public void unlink(String projectId, String partId) {
        repo.deleteByProjectIdAndPartId(projectId, partId);
    }

    private ProjectPartLinkDto toDto(ProjectPartLink l) {
        return new ProjectPartLinkDto(
                l.getPartId(), l.getPartNumber(), l.getManufacturer(), l.getDescription(),
                l.getStatus(), l.getUnitPrice(), l.getCurrency(), l.getQuantity(),
                l.getLinkedBy(), l.getPartJson());
    }
}
