package com.arrow.dws.domain.model;

/** A question raised against a design. */
public record SupportQuery(
        String reference,
        String subject,
        WorkStatus status,
        String ageLabel,
        String owner) {

    public boolean isOpen() {
        return status == WorkStatus.OPEN;
    }
}
