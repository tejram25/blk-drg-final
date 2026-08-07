package com.arrow.dws.domain.model;

/**
 * A part's production status, and how much that should worry someone.
 *
 * <p>The tone lives with the constant so there is exactly one answer to "how
 * bad is NRND", and adding a status forces a decision about it at the point of
 * adding rather than leaving a default to be discovered later.
 */
public enum PartLifecycle {
    ACTIVE("Active", Tone.POSITIVE, false),
    NRND("NRND", Tone.WARNING, true),
    LAST_TIME_BUY("Last time buy", Tone.CRITICAL, true),
    OBSOLETE("Obsolete", Tone.CRITICAL, true);

    private final String label;
    private final Tone tone;
    private final boolean atRisk;

    PartLifecycle(String label, Tone tone, boolean atRisk) {
        this.label = label;
        this.tone = tone;
        this.atRisk = atRisk;
    }

    public String label() {
        return label;
    }

    public Tone tone() {
        return tone;
    }

    /** True when the part is not in full production and needs attention. */
    public boolean isAtRisk() {
        return atRisk;
    }
}
