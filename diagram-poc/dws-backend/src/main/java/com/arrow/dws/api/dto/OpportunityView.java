package com.arrow.dws.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Everything Salesforce needs for one opportunity, in a single response.
 *
 * <p>The header fields are a copy of what Salesforce already holds. They are
 * returned so the embed can render standalone without a second lookup — not
 * because this service owns them.
 */
public record OpportunityView(
        String opportunityId,
        String designId,
        String name,
        String customer,
        String value,
        String stage,
        String region,
        String owner,
        String audience,
        Instant generatedAt,
        List<TabView> tabs) {

    public OpportunityView {
        tabs = List.copyOf(tabs);
    }
}
