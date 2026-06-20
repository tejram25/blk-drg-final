package com.example.diagram.service.impl;

import com.example.diagram.domain.Diagram;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.service.DiagramService;
import com.example.diagram.web.dto.DiagramRequest;
import com.example.diagram.web.dto.DiagramResponse;
import com.example.diagram.web.dto.DiagramSummary;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DiagramServiceImpl implements DiagramService {

    private final DiagramRepository repository;

    public DiagramServiceImpl(DiagramRepository repository) {
        this.repository = repository;
    }

    @Override
    public List<DiagramSummary> listAll() {
        return repository.findAll().stream()
                .map(d -> new DiagramSummary(d.getId(), d.getName(), d.getUpdatedAt()))
                .toList();
    }

    @Override
    public DiagramResponse get(Long id) {
        return toResponse(require(id));
    }

    @Override
    public DiagramResponse create(DiagramRequest request) {
        Diagram diagram = new Diagram();
        diagram.setName(request.name());
        diagram.setContentJson(request.contentJson());
        return toResponse(repository.save(diagram));
    }

    @Override
    public DiagramResponse update(Long id, DiagramRequest request) {
        Diagram diagram = require(id);
        diagram.setName(request.name());
        diagram.setContentJson(request.contentJson());
        return toResponse(repository.save(diagram));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private Diagram require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Diagram not found"));
    }

    private DiagramResponse toResponse(Diagram d) {
        return new DiagramResponse(d.getId(), d.getName(), d.getContentJson(), d.getUpdatedAt());
    }
}
