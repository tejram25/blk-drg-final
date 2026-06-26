package com.example.diagram.service;

import com.example.diagram.web.dto.ProjectDetail;
import com.example.diagram.web.dto.ProjectSummary;

import java.util.List;
import java.util.Optional;

/**
 * Workflow/data integration with internal systems (Salesforce Design/Deal
 * Workspace, lead-time and part data). Controllers depend on this abstraction;
 * the current implementation is mock-backed so the flow can be demoed offline.
 * A real {@code SalesforceIntegrationService} can replace it without touching
 * callers (OCP/DIP).
 */
public interface IntegrationService {

    /** Search projects/opportunities by free text (empty = all). */
    List<ProjectSummary> searchProjects(String query);

    /** Full project incl. its BOM, or empty if unknown. */
    Optional<ProjectDetail> getProject(String id);
}
