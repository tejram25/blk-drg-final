package com.example.diagram.web;

import com.example.diagram.service.SalesforceEmbedService;
import com.example.diagram.web.dto.OpportunityTabsResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The single endpoint Salesforce calls.
 *
 * <p>One request returns the whole opportunity view: header fields plus every
 * tab, each with its label, icon, badge and rendered HTML. Salesforce does not
 * need to know which tabs exist, what order they go in, or how to render any of
 * them — adding a tab here is not a Salesforce release.
 *
 * <p><b>POC:</b> unauthenticated, and the data is a fixture of three
 * opportunities. Before this is exposed anywhere real it needs the two things
 * the design calls for: a caller identity, and the server-side entitlement
 * check that decides which designs that caller may see.
 */
@RestController
@RequestMapping("/api/sfdc")
public class SalesforceEmbedController {

    private final SalesforceEmbedService embed;

    public SalesforceEmbedController(SalesforceEmbedService embed) {
        this.embed = embed;
    }

    /**
     * Every tab for one opportunity.
     *
     * @param opportunityId Salesforce opportunity id
     * @param embedded      {@code embed=true} asks for the embedded variant:
     *                      read-only fragments, no action controls, and internal
     *                      content left out of the response rather than hidden
     *                      by the UI. Defaults to true, because the only caller
     *                      today is the embed.
     */
    @GetMapping("/opportunities/{opportunityId}/tabs")
    public OpportunityTabsResponse tabs(
            @PathVariable String opportunityId,
            @RequestParam(name = "embed", defaultValue = "true") boolean embedded) {
        return embed.getOpportunityTabs(opportunityId, embedded);
    }
}
