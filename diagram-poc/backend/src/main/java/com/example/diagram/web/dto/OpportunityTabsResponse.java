package com.example.diagram.web.dto;

import java.time.Instant;
import java.util.List;

/**
 * Everything Salesforce needs to render the Design Workspace view for one
 * opportunity, in a single call.
 *
 * <p>Header fields are for the frame around the tabs — the title bar, the
 * value, the stage. They are a copy of what Salesforce already holds; they are
 * returned so the embed can render standalone without a second lookup, not
 * because this service is the system of record for them.
 *
 * @param opportunityId the Salesforce opportunity id that was asked for
 * @param projectId     the Design Workspace project linked to it
 * @param name          project name
 * @param customer      customer name
 * @param value         estimated value, preformatted for display
 * @param stage         lifecycle stage
 * @param region        eu / ap / ac
 * @param owner         who owns the project
 * @param embed         true when the caller asked for the embedded variant
 * @param generatedAt   when this response was built — nothing is cached
 * @param tabs          the tabs, already ordered
 */
public record OpportunityTabsResponse(
        String opportunityId,
        String projectId,
        String name,
        String customer,
        String value,
        String stage,
        String region,
        String owner,
        boolean embed,
        Instant generatedAt,
        List<OpportunityTab> tabs) {
}
