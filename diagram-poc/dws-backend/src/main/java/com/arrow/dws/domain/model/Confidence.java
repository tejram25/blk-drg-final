package com.arrow.dws.domain.model;

/** How much weight to give a suggestion. */
public enum Confidence {
    HIGH("High", Tone.POSITIVE),
    MEDIUM("Medium", Tone.WARNING),
    LOW("Low", Tone.NEUTRAL);

    private final String label;
    private final Tone tone;

    Confidence(String label, Tone tone) {
        this.label = label;
        this.tone = tone;
    }

    public String label() {
        return label;
    }

    public Tone tone() {
        return tone;
    }
}
