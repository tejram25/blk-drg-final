package com.arrow.dws.domain.model;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * The central object: what an FAE is designing, and everything filed against it.
 *
 * <p>The opportunity link is an {@code Optional} because a design can be
 * started cold and linked later — confirmed in the stakeholder review, and the
 * reason {@code brief} exists: for an unlinked design it is the only statement
 * of intent there is.
 *
 * <p>Collections are copied on construction. A record gives you an immutable
 * <em>reference</em>, not an immutable list, and a caller holding the list they
 * passed in can otherwise still mutate it.
 */
public record Design(
        String id,
        String name,
        String customer,
        String brief,
        String region,
        String owner,
        String estimatedValueLabel,
        LifecycleStage stage,
        LocalDate startDate,
        LocalDate targetEndDate,
        List<DesignFlag> flags,
        String internalMarginLabel,
        String opportunityId,
        List<BlockDiagram> diagrams,
        List<PartUsage> parts,
        List<DesignDocument> documents,
        List<SupportQuery> queries,
        List<Suggestion> suggestions,
        List<SupplierEngagement> suppliers) {

    public Design {
        flags = List.copyOf(flags);
        diagrams = List.copyOf(diagrams);
        parts = List.copyOf(parts);
        documents = List.copyOf(documents);
        queries = List.copyOf(queries);
        suggestions = List.copyOf(suggestions);
        suppliers = List.copyOf(suppliers);
    }

    /** Empty for an ad-hoc design that has not been linked to an opportunity. */
    public Optional<String> linkedOpportunityId() {
        return Optional.ofNullable(opportunityId);
    }

    /** Documents this audience may see — never filter this anywhere else. */
    public List<DesignDocument> documentsFor(Audience audience) {
        return documents.stream().filter(d -> d.visibleTo(audience)).toList();
    }

    /** Parts that are not in full production. */
    public List<PartUsage> partsAtRisk() {
        return parts.stream().filter(PartUsage::isAtRisk).toList();
    }

    /** Queries still awaiting an answer. */
    public List<SupportQuery> openQueries() {
        return queries.stream().filter(SupportQuery::isOpen).toList();
    }
}
