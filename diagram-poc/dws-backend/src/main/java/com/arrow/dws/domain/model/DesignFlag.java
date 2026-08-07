package com.arrow.dws.domain.model;

/** A status worth surfacing on the design at a glance. */
public enum DesignFlag {
    MY_ACTIVE("My active", Tone.POSITIVE),
    NEEDS_ACTION("Needs action", Tone.WARNING),
    STALLED("Stalled", Tone.CRITICAL),
    ON_TRACK("On track", Tone.POSITIVE);

    private final String label;
    private final Tone tone;

    DesignFlag(String label, Tone tone) {
        this.label = label;
        this.tone = tone;
    }

    public String label() {
        return label;
    }

    public Tone tone() {
        return tone;
    }

    /** Lower-case hyphenated form, for use as a field key. */
    public String key() {
        return name().toLowerCase().replace('_', '-');
    }
}
