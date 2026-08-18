package com.arrow.dws.application;

import com.arrow.dws.api.dto.OpportunityView;
import com.arrow.dws.domain.model.Audience;

/**
 * The use case Salesforce exercises: everything about one opportunity, in one
 * response.
 *
 * <p>An interface rather than a class because the controller should depend on
 * the capability, not the implementation — and because a caching or auditing
 * decorator is then a wrapper, not an edit.
 */
public interface OpportunityViewService {

    /**
     * The full tab set for an opportunity.
     *
     * @throws com.arrow.dws.api.error.NotFoundException when no design is
     *         linked to that opportunity
     */
    OpportunityView viewOpportunity(String opportunityId, Audience audience);
}
