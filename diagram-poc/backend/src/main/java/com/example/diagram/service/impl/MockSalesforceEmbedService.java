package com.example.diagram.service.impl;

import com.example.diagram.service.SalesforceEmbedService;
import com.example.diagram.service.impl.MockOpportunityCatalog.Opportunity;
import com.example.diagram.web.dto.OpportunityTab;
import com.example.diagram.web.dto.OpportunityTabsResponse;
import com.example.diagram.web.error.NotFoundException;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * POC implementation: three opportunities held in code, assembled on every
 * call. Nothing is cached, so whatever the fixture says is what the caller
 * gets — the same freshness property the real service will have, since it will
 * read the database per request rather than pushing to Salesforce.
 */
@Service
public class MockSalesforceEmbedService implements SalesforceEmbedService {

    @Override
    public OpportunityTabsResponse getOpportunityTabs(String opportunityId, boolean embed) {
        Opportunity o = MockOpportunityCatalog.find(opportunityId);
        if (o == null) {
            throw new NotFoundException("No design workspace project is linked to opportunity " + opportunityId);
        }

        List<OpportunityTab> tabs = List.of(
                OpportunityTabData.overview(o, embed),
                OpportunityTabData.blockDiagrams(o, embed),
                OpportunityTabData.partIntelligence(o, embed),
                OpportunityTabData.fastRepository(o, embed),
                OpportunityTabData.support(o, embed),
                OpportunityTabData.aiAssistant(o, embed),
                OpportunityTabData.suppliers(o, embed));

        return new OpportunityTabsResponse(
                o.opportunityId(), o.projectId(), o.name(), o.customer(), o.value(),
                o.stage(), o.region(), o.owner(), embed, Instant.now(), tabs);
    }
}
