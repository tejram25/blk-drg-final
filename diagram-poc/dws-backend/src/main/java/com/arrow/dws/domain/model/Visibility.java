package com.arrow.dws.domain.model;

/**
 * Whether a document may leave Arrow.
 *
 * <p>{@link #visibleTo(Audience)} is the single place that answers the
 * question. Scattering {@code if (embed && !doc.customerVisible())} across the
 * tabs is how one of them eventually forgets.
 */
public enum Visibility {

    /** Never leaves Arrow. */
    INTERNAL("Internal", Tone.NEUTRAL),

    /** Approved for a customer to see. */
    CUSTOMER_VISIBLE("Customer-visible", Tone.POSITIVE);

    private final String label;
    private final Tone tone;

    Visibility(String label, Tone tone) {
        this.label = label;
        this.tone = tone;
    }

    public String label() {
        return label;
    }

    public Tone tone() {
        return tone;
    }

    /** Whether this audience may be shown the thing carrying this visibility. */
    public boolean visibleTo(Audience audience) {
        return this == CUSTOMER_VISIBLE || !audience.isRestricted();
    }
}
