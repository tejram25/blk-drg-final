package com.example.diagram.service;

import com.example.diagram.web.dto.LifecycleInfo;

/**
 * Lifecycle risk + practical alternatives for a part (SiliconExpert-style).
 * Mock-backed for now; a real SiliconExpert client can replace the impl without
 * touching callers. Alternatives are limited to drop-in or approved substitutes.
 */
public interface LifecycleService {
    LifecycleInfo lookup(String partNumber);
}
