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
 * POC implementation: three opportunities held in code, rendered to HTML on
 * every call. Nothing is cached, so whatever the fixture says is what the
 * caller gets — the same freshness property the real service will have, since
 * it will read the database on each request rather than pushing to Salesforce.
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
                tab("overview", "Overview", "layout-list", 1, null, embed,
                        OpportunityTabHtml.overview(o, embed)),
                tab("block-diagrams", "Block Diagrams", "workflow", 2,
                        count(o.diagrams().size()), embed,
                        OpportunityTabHtml.blockDiagrams(o, embed)),
                tab("part-intel", "Part Intelligence", "search", 3,
                        count(o.parts().size()), embed,
                        OpportunityTabHtml.partIntelligence(o, embed)),
                tab("fast-repo", "FAST Repository", "database", 4,
                        count(visibleDocuments(o, embed)), embed,
                        OpportunityTabHtml.fastRepository(o, embed)),
                tab("support", "Support / Query", "message-circle", 5,
                        openQueries(o), embed,
                        OpportunityTabHtml.support(o, embed)),
                tab("ai-assistant", "AI Assistant", "sparkles", 6,
                        count(o.suggestions().size()), embed,
                        OpportunityTabHtml.aiAssistant(o, embed)),
                tab("supplier-collab", "Suppliers", "users", 7,
                        count(o.suppliers().size()), embed,
                        OpportunityTabHtml.suppliers(o, embed)));

        return new OpportunityTabsResponse(
                o.opportunityId(), o.projectId(), o.name(), o.customer(), o.value(),
                o.stage(), o.region(), o.owner(), embed, Instant.now(), tabs);
    }

    private static OpportunityTab tab(String key, String label, String icon, int order,
                                      String badge, boolean embed, String html) {
        return new OpportunityTab(key, label, icon, order, badge, embed, "text/html", html);
    }

    /** How many documents this variant will actually show. */
    private static int visibleDocuments(Opportunity o, boolean embed) {
        return embed
                ? (int) o.documents().stream().filter(MockOpportunityCatalog.Document::customerVisible).count()
                : o.documents().size();
    }

    /** The support badge counts what needs attention, not the total. */
    private static String openQueries(Opportunity o) {
        long open = o.queries().stream().filter(q -> "Open".equals(q.status())).count();
        return open == 0 ? null : String.valueOf(open);
    }

    private static String count(int n) {
        return n == 0 ? null : String.valueOf(n);
    }
}
