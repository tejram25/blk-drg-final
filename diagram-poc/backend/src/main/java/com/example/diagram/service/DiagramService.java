package com.example.diagram.service;

import com.example.diagram.web.dto.DiagramRequest;
import com.example.diagram.web.dto.DiagramResponse;
import com.example.diagram.web.dto.DiagramSummary;

import java.util.List;

/**
 * Diagram CRUD with access control. Controllers depend on this abstraction, not
 * on JPA. RESTRICTED diagrams (ITAR/export-control) are visible only to their
 * owner; the viewer's email is supplied from the authenticated session.
 */
public interface DiagramService {

    List<DiagramSummary> listAll(String viewerEmail);

    DiagramResponse get(Long id, String viewerEmail);

    DiagramResponse create(DiagramRequest request, String ownerEmail);

    DiagramResponse update(Long id, DiagramRequest request, String viewerEmail);

    void delete(Long id, String viewerEmail);
}
