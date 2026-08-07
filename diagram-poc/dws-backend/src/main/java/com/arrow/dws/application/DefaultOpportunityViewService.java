package com.arrow.dws.application;

import com.arrow.dws.api.dto.OpportunityView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.api.error.NotFoundException;
import com.arrow.dws.application.tab.TabContributor;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.port.DesignRepository;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.Comparator;
import java.util.List;

/**
 * Finds the design, asks every contributor for its tab, orders them.
 *
 * <p>That is the whole use case, and it is the point: this class does not know
 * how many tabs there are or what any of them contains, so a new tab never
 * touches it. It also depends on {@link DesignRepository} rather than on a
 * concrete store, so swapping the fixture for a database is an adapter change.
 *
 * <p>{@link Clock} is injected so {@code generatedAt} is testable. A direct
 * {@code Instant.now()} is a hidden dependency on the system clock and the
 * first thing that makes a response impossible to assert on.
 */
@Service
public class DefaultOpportunityViewService implements OpportunityViewService {

    private final DesignRepository designs;
    private final List<TabContributor> contributors;
    private final Clock clock;

    public DefaultOpportunityViewService(DesignRepository designs,
                                         List<TabContributor> contributors,
                                         Clock clock) {
        this.designs = designs;
        this.clock = clock;
        // Sorted once at construction: the order is a property of the set of
        // contributors, not something to recompute per request.
        this.contributors = contributors.stream()
                .sorted(Comparator.comparingInt(TabContributor::order))
                .toList();
    }

    @Override
    public OpportunityView viewOpportunity(String opportunityId, Audience audience) {
        Design design = designs.findByOpportunityId(opportunityId)
                .orElseThrow(() -> new NotFoundException(
                        "No design is linked to opportunity " + opportunityId));

        List<TabView> tabs = contributors.stream()
                .filter(c -> c.appliesTo(design, audience))
                .map(c -> c.build(design, audience))
                .toList();

        return new OpportunityView(
                opportunityId,
                design.id(),
                design.name(),
                design.customer(),
                design.estimatedValueLabel(),
                design.stage().label(),
                design.region(),
                design.owner(),
                audience.name().toLowerCase(),
                clock.instant(),
                tabs);
    }
}
