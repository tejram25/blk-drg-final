package com.arrow.dws.domain.model;

/**
 * How significant a value is.
 *
 * <p>Deciding that a last-time-buy part is critical and an NRND part is only a
 * warning is domain knowledge. Putting it here means one place owns it; put it
 * in the client and the same rules get re-implemented — and then drift — in
 * every surface that shows a part.
 *
 * <p>Deliberately not colours. The client maps these to its own palette.
 */
public enum Tone {
    NEUTRAL, POSITIVE, WARNING, CRITICAL, INFO;

    /** Lower-case wire form, so the JSON reads naturally. */
    public String wire() {
        return name().toLowerCase();
    }
}
