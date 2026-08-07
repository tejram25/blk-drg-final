package com.example.diagram.service.impl;

import com.example.diagram.web.dto.OpportunityTab;
import com.example.diagram.web.dto.OpportunityTabsResponse;
import com.example.diagram.web.error.NotFoundException;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MockSalesforceEmbedServiceTest {

    private static final String EV_BMS = "0061t00000AbCdEfGhI";
    private static final String RAIL = "0061t00000TuVwXyZaBc";

    private final MockSalesforceEmbedService service = new MockSalesforceEmbedService();

    @Test
    void returnsEverySevenTabsInOrder() {
        OpportunityTabsResponse r = service.getOpportunityTabs(EV_BMS, true);

        assertThat(r.tabs()).extracting(OpportunityTab::key).containsExactly(
                "overview", "block-diagrams", "part-intel", "fast-repo",
                "support", "ai-assistant", "supplier-collab");
        assertThat(r.tabs()).extracting(OpportunityTab::order).containsExactly(1, 2, 3, 4, 5, 6, 7);
        assertThat(r.tabs()).allSatisfy(t -> {
            assertThat(t.html()).isNotBlank();
            assertThat(t.contentType()).isEqualTo("text/html");
            assertThat(t.label()).isNotBlank();
        });
    }

    @Test
    void carriesTheOpportunityHeader() {
        OpportunityTabsResponse r = service.getOpportunityTabs(EV_BMS, true);

        assertThat(r.opportunityId()).isEqualTo(EV_BMS);
        assertThat(r.projectId()).isEqualTo("PRJ-001");
        assertThat(r.customer()).isEqualTo("Tesla Motors");
        assertThat(r.embed()).isTrue();
        assertThat(r.generatedAt()).isNotNull();
    }

    @Test
    void allThreeFixtureOpportunitiesResolve() {
        for (String id : MockOpportunityCatalog.knownIds()) {
            assertThat(service.getOpportunityTabs(id, true).tabs()).hasSize(7);
        }
    }

    @Test
    void unknownOpportunityIsNotFound() {
        assertThatThrownBy(() -> service.getOpportunityTabs("0061t00000NoSuchId", true))
                .isInstanceOf(NotFoundException.class);
    }

    /**
     * The point of the embed flag: internal content is absent from the payload,
     * not merely styled out of view. A client that reads the raw HTML must not
     * be able to recover it.
     */
    @Test
    void embedVariantOmitsInternalContentEntirely() {
        String embedded = html(service.getOpportunityTabs(EV_BMS, true));
        String internal = html(service.getOpportunityTabs(EV_BMS, false));

        assertThat(internal).contains("31.4%");            // the margin figure
        assertThat(embedded).doesNotContain("31.4%");

        assertThat(internal).contains("Thermal design note.md");   // an internal document
        assertThat(embedded).doesNotContain("Thermal design note.md");
        assertThat(embedded).contains("Preliminary BOM.xlsx");     // a customer-visible one
    }

    @Test
    void embedVariantCarriesNoActionControls() {
        String embedded = html(service.getOpportunityTabs(RAIL, true));
        String internal = html(service.getOpportunityTabs(RAIL, false));

        assertThat(internal).contains("Raise a query");
        assertThat(embedded).doesNotContain("Raise a query");
        assertThat(service.getOpportunityTabs(RAIL, true).tabs())
                .allMatch(OpportunityTab::readOnly);
    }

    @Test
    void documentBadgeCountsWhatTheVariantActuallyShows() {
        String embedded = badge(service.getOpportunityTabs(EV_BMS, true), "fast-repo");
        String internal = badge(service.getOpportunityTabs(EV_BMS, false), "fast-repo");

        assertThat(internal).isEqualTo("4");
        assertThat(embedded).isEqualTo("2");
    }

    @Test
    void supportBadgeCountsOpenQueriesOnly() {
        // Rail has two open and one answered; Smart Grid has none open.
        assertThat(badge(service.getOpportunityTabs(RAIL, true), "support")).isEqualTo("2");
        assertThat(badge(service.getOpportunityTabs("0061t00000JkLmNoPqRs", true), "support")).isNull();
    }

    /** Interpolated values are escaped, so a fragment can never carry markup. */
    @Test
    void htmlIsEscaped() {
        String h = html(service.getOpportunityTabs(RAIL, true));
        assertThat(h).contains("85 &deg;C".replace("&deg;", "°"));   // sanity: content is present
        assertThat(h).doesNotContain("<script");
    }

    private static String html(OpportunityTabsResponse r) {
        return r.tabs().stream().map(OpportunityTab::html).reduce("", String::concat);
    }

    private static String badge(OpportunityTabsResponse r, String key) {
        List<OpportunityTab> tabs = r.tabs();
        return tabs.stream().filter(t -> t.key().equals(key)).findFirst().orElseThrow().badge();
    }
}
