package com.arrow.dws;

import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.port.DesignRepository;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * A repository that holds whatever the test hands it.
 *
 * <p>Two lines of substance — which is the payoff for the port. Testing the use
 * case needs no database, no Spring context and no mocking framework.
 */
public class FakeDesignRepository implements DesignRepository {

    private final List<Design> designs;

    public FakeDesignRepository(Design... designs) {
        this.designs = Arrays.asList(designs);
    }

    @Override
    public Optional<Design> findByOpportunityId(String opportunityId) {
        return designs.stream()
                .filter(d -> d.linkedOpportunityId().filter(id -> id.equals(opportunityId)).isPresent())
                .findFirst();
    }

    @Override
    public Optional<Design> findById(String designId) {
        return designs.stream().filter(d -> d.id().equals(designId)).findFirst();
    }

    @Override
    public List<Design> findAll() {
        return designs;
    }
}
