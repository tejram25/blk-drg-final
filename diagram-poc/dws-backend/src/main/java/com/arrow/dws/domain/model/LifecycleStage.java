package com.arrow.dws.domain.model;

import java.util.List;

/** Where a design has reached. Ordered — the ordinal is the position. */
public enum LifecycleStage {
    EARLY_CONCEPT("Early/Concept"),
    DESIGN("Design Phase"),
    VALIDATION("Validation/Testing"),
    PRE_PRODUCTION("Pre-production"),
    PRODUCTION("Production"),
    LATE_ENTRY("Late Entry");

    private final String label;

    LifecycleStage(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** 1-based position, for "3 of 6". */
    public int position() {
        return ordinal() + 1;
    }

    public static int count() {
        return values().length;
    }

    public static List<LifecycleStage> ordered() {
        return List.of(values());
    }
}
