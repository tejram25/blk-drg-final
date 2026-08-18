package com.example.diagram.web.dto;

import java.util.List;

/** Full project pulled from the (mocked) Salesforce Design/Deal Workspace. */
public record ProjectDetail(
        String id,
        String name,
        String customer,
        String opportunity,
        String stage,
        int leadTimeWeeks,
        String owner,
        String region,
        List<ProjectPart> parts) {}
