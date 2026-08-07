package com.arrow.dws.domain.port;

import com.arrow.dws.domain.model.Design;

import java.util.List;
import java.util.Optional;

/**
 * How the application reaches designs.
 *
 * <p>A port, not a class: the application layer depends on this interface, and
 * an adapter supplies it. Today that adapter is an in-memory fixture; tomorrow
 * it is JPA over the workspace schema. Neither the use case nor any tab
 * contributor changes when that swap happens, and the tests keep running
 * without a database because a fake is a two-line class.
 */
public interface DesignRepository {

    /** The design linked to this Salesforce opportunity, if there is one. */
    Optional<Design> findByOpportunityId(String opportunityId);

    /** A design by its own id. */
    Optional<Design> findById(String designId);

    /** Every design. Fine for a fixture; the real adapter will page. */
    List<Design> findAll();
}
