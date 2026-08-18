package com.arrow.dws.domain.model;

/** A part used on a design, with the supply facts an FAE cares about. */
public record PartUsage(
        String manufacturerPartNumber,
        String manufacturer,
        String function,
        PartLifecycle lifecycle,
        String leadTimeLabel,
        String stockLabel) {

    /** True when this part needs attention before the design can be committed. */
    public boolean isAtRisk() {
        return lifecycle.isAtRisk();
    }
}
