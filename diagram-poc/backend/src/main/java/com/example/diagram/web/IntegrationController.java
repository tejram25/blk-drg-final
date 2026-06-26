package com.example.diagram.web;

import com.example.diagram.service.IntegrationService;
import com.example.diagram.web.dto.ProjectDetail;
import com.example.diagram.web.dto.ProjectSummary;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Workflow/data integration endpoints: pull project, opportunity, lead-time and
 * part data from the (mocked) Salesforce Design/Deal Workspace. Thin — delegates
 * to {@link IntegrationService}.
 */
@RestController
@RequestMapping("/api/integrations")
public class IntegrationController {

    private final IntegrationService integrations;

    public IntegrationController(IntegrationService integrations) {
        this.integrations = integrations;
    }

    @GetMapping("/projects")
    public List<ProjectSummary> projects(@RequestParam(name = "q", required = false) String query) {
        return integrations.searchProjects(query);
    }

    @GetMapping("/projects/{id}")
    public ProjectDetail project(@PathVariable String id) {
        return integrations.getProject(id)
                .orElseThrow(() -> new NotFoundException("Project not found"));
    }
}
