package com.example.diagram.service.impl;

import com.example.diagram.web.dto.OpportunityTab;
import com.example.diagram.web.dto.OpportunityTabsResponse;
import com.example.diagram.web.dto.TabField;
import com.example.diagram.web.dto.TabItem;
import com.example.diagram.web.error.NotFoundException;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MockSalesforceEmbedServiceTest {

    private static final String EV_BMS = "0061t00000AbCdEfGhI";
    private static final String SMART_GRID = "0061t00000JkLmNoPqRs";
    private static final String RAIL = "0061t00000TuVwXyZaBc";

    private final MockSalesforceEmbedService service = new MockSalesforceEmbedService();

    @Test
    void returnsSevenTabsInOrder() {
        OpportunityTabsResponse r = service.getOpportunityTabs(EV_BMS, true);

        assertThat(r.tabs()).extracting(OpportunityTab::key).containsExactly(
                "overview", "block-diagrams", "part-intel", "fast-repo",
                "support", "ai-assistant", "supplier-collab");
        assertThat(r.tabs()).extracting(OpportunityTab::order).containsExactly(1, 2, 3, 4, 5, 6, 7);
    }

    /**
     * The shape is uniform on purpose — one client renderer covers every tab.
     * If a tab ever ships an empty field list or a field without a key, that
     * renderer starts producing blanks.
     */
    @Test
    void everyTabHasTheSameShape() {
        for (OpportunityTab t : service.getOpportunityTabs(RAIL, true).tabs()) {
            assertThat(t.label()).isNotBlank();
            assertThat(t.icon()).isNotBlank();
            assertThat(t.fields()).isNotEmpty();
            assertThat(t.fields()).allSatisfy(f -> {
                assertThat(f.key()).isNotBlank();
                assertThat(f.label()).isNotBlank();
                assertThat(f.value()).isNotNull();
                assertThat(f.tone()).isIn(TabField.NEUTRAL, TabField.POSITIVE,
                        TabField.WARNING, TabField.CRITICAL, TabField.INFO);
            });
            assertThat(t.items()).allSatisfy(i -> {
                assertThat(i.key()).isNotBlank();
                assertThat(i.title()).isNotBlank();
                assertThat(i.fields()).isNotEmpty();
            });
        }
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
     * not merely flagged. A client reading the raw JSON must not recover it.
     */
    @Test
    void embedVariantOmitsInternalContentEntirely() {
        OpportunityTabsResponse embedded = service.getOpportunityTabs(EV_BMS, true);
        OpportunityTabsResponse internal = service.getOpportunityTabs(EV_BMS, false);

        assertThat(fieldKeys(internal, "overview")).contains("margin");
        assertThat(fieldKeys(embedded, "overview")).doesNotContain("margin");

        assertThat(itemKeys(internal, "fast-repo")).contains("Thermal design note.md");
        assertThat(itemKeys(embedded, "fast-repo"))
                .doesNotContain("Thermal design note.md")
                .contains("Preliminary BOM.xlsx");
    }

    @Test
    void everyTabIsReadOnlyInTheEmbeddedVariant() {
        assertThat(service.getOpportunityTabs(RAIL, true).tabs()).allMatch(OpportunityTab::readOnly);
        assertThat(service.getOpportunityTabs(RAIL, false).tabs()).noneMatch(OpportunityTab::readOnly);
    }

    /** Counts must describe what the caller actually received. */
    @Test
    void documentCountMatchesTheItemsReturned() {
        for (boolean embed : List.of(true, false)) {
            OpportunityTabsResponse r = service.getOpportunityTabs(EV_BMS, embed);
            OpportunityTab t = tab(r, "fast-repo");
            String declared = field(t, "documentCount").value();
            assertThat(declared).isEqualTo(String.valueOf(t.items().size()));
            assertThat(t.badge()).isEqualTo(declared);
        }
        assertThat(tab(service.getOpportunityTabs(EV_BMS, true), "fast-repo").items()).hasSize(2);
        assertThat(tab(service.getOpportunityTabs(EV_BMS, false), "fast-repo").items()).hasSize(4);
    }

    @Test
    void supportBadgeCountsOpenQueriesOnly() {
        // Rail has two open and one answered; Smart Grid has none open.
        OpportunityTab rail = tab(service.getOpportunityTabs(RAIL, true), "support");
        assertThat(rail.badge()).isEqualTo("2");
        assertThat(rail.items()).hasSize(3);

        assertThat(tab(service.getOpportunityTabs(SMART_GRID, true), "support").badge()).isNull();
    }

    /** Tone is domain knowledge, not styling — the client should not re-derive it. */
    @Test
    void lifecycleRiskCarriesItsOwnTone() {
        OpportunityTab parts = tab(service.getOpportunityTabs(RAIL, true), "part-intel");

        assertThat(itemField(parts, "SN65HVD255", "lifecycle").tone()).isEqualTo(TabField.CRITICAL);
        assertThat(itemField(parts, "TMS570LC4357", "lifecycle").tone()).isEqualTo(TabField.POSITIVE);
        assertThat(field(parts, "partsAtRisk").tone()).isEqualTo(TabField.WARNING);
        assertThat(parts.note()).contains("1 part is not in full production");
    }

    @Test
    void tabWithNoRisksHasNoNoteAndAPositiveTone() {
        OpportunityTab parts = tab(service.getOpportunityTabs(SMART_GRID, true), "part-intel");

        assertThat(field(parts, "partsAtRisk").value()).isEqualTo("0");
        assertThat(field(parts, "partsAtRisk").tone()).isEqualTo(TabField.POSITIVE);
        assertThat(parts.note()).isNull();
    }

    // ------------------------------------------------------------- helpers

    private static OpportunityTab tab(OpportunityTabsResponse r, String key) {
        return r.tabs().stream().filter(t -> t.key().equals(key)).findFirst().orElseThrow();
    }

    private static TabField field(OpportunityTab t, String key) {
        return t.fields().stream().filter(f -> f.key().equals(key)).findFirst().orElseThrow();
    }

    private static TabField itemField(OpportunityTab t, String itemKey, String fieldKey) {
        Optional<TabItem> item = t.items().stream().filter(i -> i.key().equals(itemKey)).findFirst();
        return item.orElseThrow().fields().stream()
                .filter(f -> f.key().equals(fieldKey)).findFirst().orElseThrow();
    }

    private static List<String> fieldKeys(OpportunityTabsResponse r, String tabKey) {
        return tab(r, tabKey).fields().stream().map(TabField::key).toList();
    }

    private static List<String> itemKeys(OpportunityTabsResponse r, String tabKey) {
        return tab(r, tabKey).items().stream().map(TabItem::key).toList();
    }
}
