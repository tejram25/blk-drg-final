package com.arrow.dws.domain.model;

/** Where a piece of work has got to. Shared by diagrams, queries and suppliers. */
public enum WorkStatus {
    DRAFT("Draft", Tone.NEUTRAL),
    IN_REVIEW("In review", Tone.INFO),
    NEEDS_REWORK("Needs rework", Tone.CRITICAL),
    APPROVED("Approved", Tone.POSITIVE),
    OPEN("Open", Tone.WARNING),
    ANSWERED("Answered", Tone.POSITIVE),
    QUOTED("Quoted", Tone.INFO),
    ENGAGED("Engaged", Tone.INFO),
    COMMITTED("Committed", Tone.POSITIVE);

    private final String label;
    private final Tone tone;

    WorkStatus(String label, Tone tone) {
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
