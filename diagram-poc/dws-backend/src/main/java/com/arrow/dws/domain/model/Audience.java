package com.arrow.dws.domain.model;

/**
 * Who is asking, and therefore what they may be told.
 *
 * <p>This is an enum rather than a {@code boolean embed} on purpose. A boolean
 * at a boundary answers one question and cannot answer a second: the day a
 * third audience appears — a partner portal, a customer-facing share link —
 * every signature carrying the boolean has to change, and every call site has
 * to be re-read to work out which way round {@code true} meant. Adding a
 * constant here does not change a single signature.
 */
public enum Audience {

    /** Arrow staff inside the workspace. Sees everything. */
    INTERNAL,

    /** The read-only view embedded in Salesforce. Sees approved content only. */
    EMBEDDED;

    /** True when this audience must not be shown internal-only content. */
    public boolean isRestricted() {
        return this == EMBEDDED;
    }

    /** True when this audience may act, rather than only read. */
    public boolean canAct() {
        return this == INTERNAL;
    }
}
