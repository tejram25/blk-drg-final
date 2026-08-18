package com.example.diagram.service.impl;

import com.example.diagram.service.IntegrationService;
import com.example.diagram.web.dto.ProjectDetail;
import com.example.diagram.web.dto.ProjectPart;
import com.example.diagram.web.dto.ProjectSummary;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Mock implementation of the workflow/data integration. Serves a small set of
 * canned Salesforce-style projects so "attach a project → pull opportunity,
 * lead-time and part data" works without live credentials. Swap for a real
 * Salesforce client (same interface) when API access is available.
 */
@Service
public class MockIntegrationService implements IntegrationService {

    private static final List<ProjectDetail> PROJECTS = List.of(
            new ProjectDetail("OPP-10241", "AMR Fleet Controller", "Nordic Robotics",
                    "OPP-10241 · Design Win", "Design In", 14, "Priya Nair", "EMEA",
                    List.of(
                            new ProjectPart("INA250A3PWR", "Texas Instruments", "Current Sense Amplifier", 4, 12, "Active"),
                            new ProjectPart("ESP32-WROOM-32", "Espressif", "Wi-Fi/BLE MCU Module", 1, 16, "Active"),
                            new ProjectPart("LM317T", "STMicroelectronics", "Adjustable LDO Regulator", 2, 8, "Active"))),
            new ProjectDetail("OPP-10588", "Smart Microgrid Inverter", "Helios Energy",
                    "OPP-10588 · RFQ", "Quoted", 20, "Liam O'Brien", "AMER",
                    List.of(
                            new ProjectPart("DS91C176TMA/NOPB", "Texas Instruments", "LVDS Transceiver", 2, 18, "NRND"),
                            new ProjectPart("GRM188R71H104KA93D", "Murata", "0.1uF MLCC", 24, 6, "Active"))),
            new ProjectDetail("OPP-10934", "Industrial Sensor Hub", "Meridian Controls",
                    "OPP-10934 · Sampling", "Prototype", 10, "Aisha Khan", "APAC",
                    List.of(
                            new ProjectPart("BAV23S", "onsemi", "Switching Diode", 6, 9, "Active"),
                            new ProjectPart("INA250A3PWR", "Texas Instruments", "Current Sense Amplifier", 2, 12, "Active")))
    );

    @Override
    public List<ProjectSummary> searchProjects(String query) {
        String q = query == null ? "" : query.trim().toLowerCase();
        return PROJECTS.stream()
                .filter(p -> q.isEmpty() || matches(p, q))
                .map(this::toSummary)
                .toList();
    }

    @Override
    public Optional<ProjectDetail> getProject(String id) {
        return PROJECTS.stream().filter(p -> p.id().equalsIgnoreCase(id)).findFirst();
    }

    private boolean matches(ProjectDetail p, String q) {
        return (p.name() + " " + p.customer() + " " + p.opportunity() + " " + p.id()).toLowerCase().contains(q);
    }

    private ProjectSummary toSummary(ProjectDetail p) {
        return new ProjectSummary(p.id(), p.name(), p.customer(), p.opportunity(), p.stage(), p.leadTimeWeeks());
    }
}
