package com.arrow.dws.domain.model;

/** Something the assistant thinks is worth doing, and why. */
public record Suggestion(String title, String rationale, Confidence confidence) {
}
