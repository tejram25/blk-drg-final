package com.example.diagram.web;

import com.example.diagram.domain.UsageEvent;
import com.example.diagram.service.AuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Adoption / audit dashboard. Surfaces usage counts by action and by region,
 * plus the most recent audit trail entries.
 */
@RestController
@RequestMapping("/api/metrics")
public class MetricsController {

    private final AuditService audit;

    public MetricsController(AuditService audit) {
        this.audit = audit;
    }

    @GetMapping
    public Map<String, Object> summary() {
        return Map.of(
                "byAction", audit.countsByAction(),
                "byRegion", audit.countsByRegion());
    }

    @GetMapping("/events")
    public List<UsageEvent> events() {
        return audit.recent();
    }
}
