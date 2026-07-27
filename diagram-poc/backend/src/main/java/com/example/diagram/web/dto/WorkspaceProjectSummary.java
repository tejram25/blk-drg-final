package com.example.diagram.web.dto;

import java.time.Instant;

/**
 * A project as it appears in a list, the Ctrl+O picker, or a search result.
 *
 * <p>Salesforce owns the project record and its workflow; this workspace mirrors
 * it nightly and hangs engineering artefacts off it. {@code sfdcId} is the
 * Salesforce object id (the system-of-record key); {@code id} is the
 * human-facing project code (e.g. {@code PRJ-4821}).
 *
 * <p>{@code stage} is one of Discovery, Design, Prototype, Production, Won, Lost.
 * {@code health} is one of ok, warn, risk. {@code value} is the opportunity
 * value in whole USD. {@code diagrams} and {@code parts} are rollup counts shown
 * on the card without loading the full project.
 */
public record WorkspaceProjectSummary(
        String id,
        String sfdcId,
        String name,
        String customer,
        String category,
        String stage,
        long value,
        String owner,
        String health,
        Instant updatedAt,
        int diagrams,
        int parts) {}
