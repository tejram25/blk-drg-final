package com.example.diagram.service;

import com.example.diagram.domain.UsageEvent;

import java.util.List;
import java.util.Map;

/**
 * Records audit / adoption events and exposes simple aggregates for the
 * metrics dashboard. Kept behind an interface so the diagram service depends on
 * the abstraction, not on JPA.
 */
public interface AuditService {

    /** Record an action against an (optional) diagram. */
    void record(String action, String userEmail, Long diagramId, String classification);

    /** Most recent events, newest first (capped). */
    List<UsageEvent> recent();

    /** Count of events grouped by action. */
    Map<String, Long> countsByAction();

    /** Count of events grouped by coarse region, for regional adoption metrics. */
    Map<String, Long> countsByRegion();
}
