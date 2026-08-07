package com.example.diagram.web.dto;

/**
 * One key/value pair.
 *
 * <p>{@code tone} exists so the client can colour a value without parsing it.
 * Deciding that "Last time buy" is a warning is domain knowledge; it belongs
 * here, not in a switch statement inside a Lightning component.
 *
 * @param key   stable identifier — safe to branch on, never shown to a user
 * @param label the human label
 * @param value the value, already formatted for display
 * @param tone  one of {@code neutral}, {@code positive}, {@code warning},
 *              {@code critical}, {@code info}
 */
public record TabField(String key, String label, String value, String tone) {

    /** Tone values, so callers and tests agree on the vocabulary. */
    public static final String NEUTRAL = "neutral";
    public static final String POSITIVE = "positive";
    public static final String WARNING = "warning";
    public static final String CRITICAL = "critical";
    public static final String INFO = "info";

    /** A pair with no particular significance. */
    public static TabField of(String key, String label, String value) {
        return new TabField(key, label, value, NEUTRAL);
    }
}
