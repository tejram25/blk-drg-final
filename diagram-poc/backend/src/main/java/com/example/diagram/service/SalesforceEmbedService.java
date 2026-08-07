package com.example.diagram.service;

import com.example.diagram.web.dto.OpportunityTabsResponse;

/**
 * The one thing Salesforce calls. Everything the opportunity view needs comes
 * back in a single response, so the page makes one request and renders.
 */
public interface SalesforceEmbedService {

    /**
     * The full tab set for an opportunity.
     *
     * @param opportunityId Salesforce opportunity id
     * @param embed         true for the embedded variant: read-only fragments
     *                      with no action controls and no internal-only cards.
     *                      false returns the same tabs with the controls the
     *                      workspace itself shows.
     * @throws com.example.diagram.web.error.NotFoundException if no project is
     *         linked to that opportunity
     */
    OpportunityTabsResponse getOpportunityTabs(String opportunityId, boolean embed);
}
