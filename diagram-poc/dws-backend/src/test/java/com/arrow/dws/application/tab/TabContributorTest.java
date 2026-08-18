package com.arrow.dws.application.tab;

import com.arrow.dws.TestDesigns;
import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.ItemView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.Tone;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Rules every tab must obey, applied to every tab.
 *
 * <p>A new contributor is picked up here automatically, so the invariants
 * cannot be forgotten by whoever adds the eighth tab.
 */
class TabContributorTest {

    private static Stream<TabContributor> allContributors() {
        return Stream.of(
                new OverviewTabContributor(),
                new BlockDiagramsTabContributor(),
                new PartIntelligenceTabContributor(),
                new RepositoryTabContributor(),
                new SupportTabContributor(),
                new AiAssistantTabContributor(),
                new SuppliersTabContributor());
    }

    @ParameterizedTest
    @MethodSource("allContributors")
    void producesAWellFormedTab(TabContributor contributor) {
        TabView tab = contributor.build(TestDesigns.builder().build(), Audience.EMBEDDED);

        assertThat(tab.key()).isEqualTo(contributor.key());
        assertThat(tab.order()).isEqualTo(contributor.order());
        assertThat(tab.label()).isNotBlank();
        assertThat(tab.icon()).isNotBlank();
        assertThat(tab.fields()).isNotEmpty();

        assertThat(tab.fields()).allSatisfy(TabContributorTest::assertWellFormed);
        assertThat(tab.items()).allSatisfy(item -> {
            assertThat(item.key()).isNotBlank();
            assertThat(item.title()).isNotBlank();
            assertThat(item.fields()).isNotEmpty();
            assertThat(item.fields()).allSatisfy(TabContributorTest::assertWellFormed);
        });
    }

    /** readOnly follows the audience, everywhere, without each tab deciding. */
    @ParameterizedTest
    @MethodSource("allContributors")
    void readOnlyTracksTheAudience(TabContributor contributor) {
        Design design = TestDesigns.builder().build();

        assertThat(contributor.build(design, Audience.EMBEDDED).readOnly()).isTrue();
        assertThat(contributor.build(design, Audience.INTERNAL).readOnly()).isFalse();
    }

    /** A badge that disagrees with the list tells the user something false. */
    @ParameterizedTest
    @MethodSource("allContributors")
    void badgeNeverOverstatesWhatWasReturned(TabContributor contributor) {
        for (Audience audience : Audience.values()) {
            TabView tab = contributor.build(TestDesigns.withMixedDocuments(), audience);
            if (tab.badge() != null) {
                assertThat(Integer.parseInt(tab.badge()))
                        .as("%s badge for %s", tab.key(), audience)
                        .isLessThanOrEqualTo(tab.items().size());
            }
        }
    }

    @ParameterizedTest
    @EnumSource(Audience.class)
    void everyKeyIsUniqueWithinItsScope(Audience audience) {
        allContributors().forEach(contributor -> {
            TabView tab = contributor.build(TestDesigns.builder().build(), audience);
            assertThat(tab.fields()).extracting(FieldView::key).doesNotHaveDuplicates();
            assertThat(tab.items()).extracting(ItemView::key).doesNotHaveDuplicates();
            tab.items().forEach(item ->
                    assertThat(item.fields()).extracting(FieldView::key).doesNotHaveDuplicates());
        });
    }

    // ------------------------------------------------- tab-specific behaviour

    @Test
    void repositoryWithholdsInternalDocumentsFromARestrictedAudience() {
        RepositoryTabContributor contributor = new RepositoryTabContributor();
        Design design = TestDesigns.withMixedDocuments();

        TabView embedded = contributor.build(design, Audience.EMBEDDED);
        TabView internal = contributor.build(design, Audience.INTERNAL);

        assertThat(embedded.items()).extracting(ItemView::key)
                .containsExactly("Public.pdf");
        assertThat(internal.items()).extracting(ItemView::key)
                .containsExactly("Public.pdf", "Secret.md");
        assertThat(embedded.note()).contains("1 internal document is not returned");
        assertThat(internal.note()).isNull();
    }

    /**
     * The embedded variant carries no visibility field at all — there is
     * nothing left to disclose once everything returned is customer-visible.
     */
    @Test
    void repositoryOmitsVisibilityWhereItWouldSayNothing() {
        RepositoryTabContributor contributor = new RepositoryTabContributor();
        Design design = TestDesigns.withMixedDocuments();

        assertThat(fieldKeysOfFirstItem(contributor.build(design, Audience.EMBEDDED)))
                .doesNotContain("visibility");
        assertThat(fieldKeysOfFirstItem(contributor.build(design, Audience.INTERNAL)))
                .contains("visibility");
    }

    @Test
    void overviewWithholdsMarginFromARestrictedAudience() {
        OverviewTabContributor contributor = new OverviewTabContributor();
        Design design = TestDesigns.builder().build();

        assertThat(keys(contributor.build(design, Audience.EMBEDDED))).doesNotContain("margin");
        assertThat(keys(contributor.build(design, Audience.INTERNAL))).contains("margin");
    }

    @Test
    void partIntelligenceCarriesLifecycleRiskAsTone() {
        TabView tab = new PartIntelligenceTabContributor()
                .build(TestDesigns.withAtRiskPart(), Audience.EMBEDDED);

        assertThat(itemField(tab, "RISKY1", "lifecycle").tone()).isEqualTo(Tone.CRITICAL.wire());
        assertThat(itemField(tab, "GOOD1", "lifecycle").tone()).isEqualTo(Tone.POSITIVE.wire());
        assertThat(field(tab, "partsAtRisk").value()).isEqualTo("1");
        assertThat(field(tab, "partsAtRisk").tone()).isEqualTo(Tone.WARNING.wire());
        assertThat(tab.note()).isEqualTo(
                "1 part is not in full production. See the AI Assistant tab for alternates.");
    }

    @Test
    void partIntelligenceSaysNothingWhenNothingIsAtRisk() {
        TabView tab = new PartIntelligenceTabContributor()
                .build(TestDesigns.builder().build(), Audience.EMBEDDED);

        assertThat(field(tab, "partsAtRisk").value()).isEqualTo("0");
        assertThat(field(tab, "partsAtRisk").tone()).isEqualTo(Tone.POSITIVE.wire());
        assertThat(tab.note()).isNull();
    }

    /** The support badge is about what needs attention, not about volume. */
    @Test
    void supportBadgeCountsOpenQueriesNotAllOfThem() {
        TabView tab = new SupportTabContributor().build(TestDesigns.withOpenQueries(), Audience.EMBEDDED);

        assertThat(tab.items()).hasSize(3);
        assertThat(tab.badge()).isEqualTo("2");
        assertThat(field(tab, "openQueries").value()).isEqualTo("2");
        assertThat(field(tab, "totalQueries").value()).isEqualTo("3");
    }

    @Test
    void supportHasNoBadgeWhenNothingIsOpen() {
        TabView tab = new SupportTabContributor().build(TestDesigns.builder().build(), Audience.EMBEDDED);

        assertThat(tab.badge()).isNull();
        assertThat(field(tab, "openQueries").tone()).isEqualTo(Tone.POSITIVE.wire());
    }

    // ------------------------------------------------------------- helpers

    private static void assertWellFormed(FieldView f) {
        assertThat(f.key()).isNotBlank();
        assertThat(f.label()).isNotBlank();
        assertThat(f.value()).isNotNull();
        assertThat(f.tone()).isIn(Stream.of(Tone.values()).map(Tone::wire).toList());
    }

    private static List<String> keys(TabView tab) {
        return tab.fields().stream().map(FieldView::key).toList();
    }

    private static List<String> fieldKeysOfFirstItem(TabView tab) {
        return tab.items().get(0).fields().stream().map(FieldView::key).toList();
    }

    private static FieldView field(TabView tab, String key) {
        return tab.fields().stream().filter(f -> f.key().equals(key)).findFirst().orElseThrow();
    }

    private static FieldView itemField(TabView tab, String itemKey, String fieldKey) {
        return tab.items().stream().filter(i -> i.key().equals(itemKey)).findFirst().orElseThrow()
                .fields().stream().filter(f -> f.key().equals(fieldKey)).findFirst().orElseThrow();
    }
}
