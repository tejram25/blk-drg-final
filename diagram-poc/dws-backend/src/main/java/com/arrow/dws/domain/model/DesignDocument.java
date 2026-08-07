package com.arrow.dws.domain.model;

/** A document filed against a design. */
public record DesignDocument(
        String name,
        String kind,
        String sizeLabel,
        String updatedLabel,
        Visibility visibility) {

    /** Whether this document may be shown to the given audience. */
    public boolean visibleTo(Audience audience) {
        return visibility.visibleTo(audience);
    }
}
