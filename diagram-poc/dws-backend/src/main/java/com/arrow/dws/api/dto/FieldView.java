package com.arrow.dws.api.dto;

import com.arrow.dws.domain.model.Tone;

/**
 * One key/value pair on the wire.
 *
 * @param key   stable identifier — branch on this, never show it
 * @param label the human label
 * @param value already formatted for display
 * @param tone  {@code neutral} · {@code positive} · {@code warning} ·
 *              {@code critical} · {@code info}
 */
public record FieldView(String key, String label, String value, String tone) {

    /** A pair with no particular significance. */
    public static FieldView of(String key, String label, String value) {
        return new FieldView(key, label, value, Tone.NEUTRAL.wire());
    }

    /** A pair whose value carries weight. */
    public static FieldView of(String key, String label, String value, Tone tone) {
        return new FieldView(key, label, value, tone.wire());
    }
}
