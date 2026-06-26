package com.example.diagram.web.dto;

/** Lightweight project/opportunity listing from the Design/Deal Workspace. */
public record ProjectSummary(
        String id,
        String name,
        String customer,
        String opportunity,
        String stage,
        int leadTimeWeeks) {}
