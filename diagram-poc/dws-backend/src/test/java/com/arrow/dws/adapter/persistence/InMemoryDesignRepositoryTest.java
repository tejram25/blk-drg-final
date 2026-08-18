package com.arrow.dws.adapter.persistence;

import com.arrow.dws.domain.model.Design;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** The fixture is data, so the tests on it check the contract, not the content. */
class InMemoryDesignRepositoryTest {

    private final InMemoryDesignRepository repository = new InMemoryDesignRepository();

    @Test
    void holdsThreeDesignsEachLinkedToAnOpportunity() {
        assertThat(repository.findAll()).hasSize(3);
        assertThat(repository.findAll()).allSatisfy(d ->
                assertThat(d.linkedOpportunityId()).isPresent());
    }

    @Test
    void findsByOpportunityIdAndByDesignId() {
        Optional<Design> byOpportunity = repository.findByOpportunityId("0061t00000AbCdEfGhI");

        assertThat(byOpportunity).isPresent();
        assertThat(byOpportunity.get().id()).isEqualTo("PRJ-001");
        assertThat(repository.findById("PRJ-001")).contains(byOpportunity.get());
    }

    @Test
    void toleratesSurroundingWhitespace() {
        assertThat(repository.findByOpportunityId("  0061t00000AbCdEfGhI  ")).isPresent();
    }

    @Test
    void returnsEmptyRatherThanThrowingOnUnknownOrNull() {
        assertThat(repository.findByOpportunityId("0061t00000UNKNOWN01")).isEmpty();
        assertThat(repository.findByOpportunityId(null)).isEmpty();
        assertThat(repository.findById(null)).isEmpty();
    }

    /**
     * A record gives an immutable reference, not an immutable list. Design
     * copies its collections precisely so a caller cannot reach back in.
     */
    @Test
    void designCollectionsCannotBeMutatedByACaller() {
        Design design = repository.findById("PRJ-001").orElseThrow();

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> design.documents().add(null))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
