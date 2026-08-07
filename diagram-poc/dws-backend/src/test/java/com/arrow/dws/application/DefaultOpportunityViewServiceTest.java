package com.arrow.dws.application;

import com.arrow.dws.FakeDesignRepository;
import com.arrow.dws.TestDesigns;
import com.arrow.dws.api.dto.OpportunityView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.api.error.NotFoundException;
import com.arrow.dws.application.tab.TabBuilder;
import com.arrow.dws.application.tab.TabContributor;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DefaultOpportunityViewServiceTest {

    private static final Instant FIXED = Instant.parse("2026-01-01T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(FIXED, ZoneOffset.UTC);

    /** A contributor that exists only for this test — the extension point in use. */
    private record StubTab(String key, int order, boolean applies) implements TabContributor {
        @Override
        public boolean appliesTo(Design design, Audience audience) {
            return applies;
        }

        @Override
        public TabView build(Design design, Audience audience) {
            return TabBuilder.of(key, key, "icon", order, audience).field("k", "l", "v").build();
        }
    }

    private DefaultOpportunityViewService service(Design design, TabContributor... tabs) {
        return new DefaultOpportunityViewService(new FakeDesignRepository(design), List.of(tabs), CLOCK);
    }

    /**
     * The reason the contributor interface exists: a new tab is registered, not
     * wired in. If this ever needs the service to change, the design has been
     * lost.
     */
    @Test
    void assemblesWhateverContributorsAreRegistered() {
        Design design = TestDesigns.builder().build();

        OpportunityView view = service(design,
                new StubTab("first", 1, true),
                new StubTab("second", 2, true))
                .viewOpportunity("0061t00000TESTID001", Audience.EMBEDDED);

        assertThat(view.tabs()).extracting(TabView::key).containsExactly("first", "second");
    }

    @Test
    void ordersContributorsRegardlessOfInjectionOrder() {
        Design design = TestDesigns.builder().build();

        OpportunityView view = service(design,
                new StubTab("third", 3, true),
                new StubTab("first", 1, true),
                new StubTab("second", 2, true))
                .viewOpportunity("0061t00000TESTID001", Audience.EMBEDDED);

        assertThat(view.tabs()).extracting(TabView::key).containsExactly("first", "second", "third");
    }

    @Test
    void omitsATabThatDoesNotApply() {
        Design design = TestDesigns.builder().build();

        OpportunityView view = service(design,
                new StubTab("shown", 1, true),
                new StubTab("hidden", 2, false))
                .viewOpportunity("0061t00000TESTID001", Audience.EMBEDDED);

        assertThat(view.tabs()).extracting(TabView::key).containsExactly("shown");
    }

    @Test
    void carriesTheDesignHeaderAndTheAudience() {
        Design design = TestDesigns.builder().id("PRJ-042").build();

        OpportunityView view = service(design, new StubTab("only", 1, true))
                .viewOpportunity("0061t00000TESTID001", Audience.INTERNAL);

        assertThat(view.opportunityId()).isEqualTo("0061t00000TESTID001");
        assertThat(view.designId()).isEqualTo("PRJ-042");
        assertThat(view.customer()).isEqualTo("Test Customer");
        assertThat(view.audience()).isEqualTo("internal");
    }

    /** The injected clock is what makes this assertable rather than approximate. */
    @Test
    void stampsTheResponseFromTheInjectedClock() {
        OpportunityView view = service(TestDesigns.builder().build(), new StubTab("only", 1, true))
                .viewOpportunity("0061t00000TESTID001", Audience.EMBEDDED);

        assertThat(view.generatedAt()).isEqualTo(FIXED);
    }

    @Test
    void unknownOpportunityIsNotFound() {
        assertThatThrownBy(() -> service(TestDesigns.builder().build(), new StubTab("only", 1, true))
                .viewOpportunity("0061t00000UNKNOWN01", Audience.EMBEDDED))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("0061t00000UNKNOWN01");
    }

    /** An ad-hoc design is reachable by id but not by opportunity. */
    @Test
    void designWithNoOpportunityIsNotReachableThroughThisUseCase() {
        Design adHoc = TestDesigns.builder().opportunityId(null).build();

        assertThatThrownBy(() -> service(adHoc, new StubTab("only", 1, true))
                .viewOpportunity("0061t00000TESTID001", Audience.EMBEDDED))
                .isInstanceOf(NotFoundException.class);
    }
}
