package com.example.diagram.service;

import com.example.diagram.web.dto.DiagramRequest;
import com.example.diagram.web.dto.DiagramResponse;
import com.example.diagram.web.dto.DiagramSummary;

import java.util.List;

/** Diagram CRUD operations. Controllers depend on this abstraction, not on JPA. */
public interface DiagramService {

    List<DiagramSummary> listAll();

    DiagramResponse get(Long id);

    DiagramResponse create(DiagramRequest request);

    DiagramResponse update(Long id, DiagramRequest request);

    void delete(Long id);
}
