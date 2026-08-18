package com.example.diagram.web.dto;

import java.util.List;

/** Lifecycle risk + alternatives for a part (SiliconExpert-style). */
public record LifecycleInfo(
        String partNumber,
        String status,
        String risk,
        String recommendation,
        List<AlternativePart> alternatives) {}
