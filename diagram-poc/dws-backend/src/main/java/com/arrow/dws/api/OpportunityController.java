package com.arrow.dws.api;

import com.arrow.dws.api.dto.OpportunityView;
import com.arrow.dws.application.OpportunityViewService;
import com.arrow.dws.domain.model.Audience;

import jakarta.validation.constraints.NotBlank;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The single endpoint Salesforce calls.
 *
 * <p>Thin on purpose: translate the request, delegate, return. It holds no
 * knowledge of tabs, so it is not a place anyone has to edit when the view
 * grows.
 *
 * <p><b>POC:</b> unauthenticated. The design calls for a caller identity and a
 * membership check deciding which designs that caller may see;
 * {@code embed=true} filters <em>content</em>, not <em>access</em>, and the two
 * are not substitutes.
 */
@RestController
@RequestMapping("/api/sfdc")
@Validated
public class OpportunityController {

    private final OpportunityViewService opportunities;

    public OpportunityController(OpportunityViewService opportunities) {
        this.opportunities = opportunities;
    }

    /**
     * Every tab for one opportunity.
     *
     * @param opportunityId Salesforce opportunity id
     * @param embed         {@code true} — the default — asks for the embedded
     *                      variant: read-only, with internal content left out
     *                      of the response rather than hidden by the client.
     *                      Defaults to true because the only caller today is
     *                      the embed, and a forgotten parameter must not serve
     *                      the internal variant.
     */
    @GetMapping("/opportunities/{opportunityId}/tabs")
    public OpportunityView tabs(
            @PathVariable @NotBlank String opportunityId,
            @RequestParam(name = "embed", defaultValue = "true") boolean embed) {
        return opportunities.viewOpportunity(opportunityId, embed ? Audience.EMBEDDED : Audience.INTERNAL);
    }
}
