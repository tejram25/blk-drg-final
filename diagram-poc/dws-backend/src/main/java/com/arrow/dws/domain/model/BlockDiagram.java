package com.arrow.dws.domain.model;

/**
 * A block diagram belonging to a design.
 *
 * <p>The workspace holds the reference; the diagram itself lives in the block
 * diagram service. This record is deliberately thin — if it grew a canvas or a
 * revision history, the two services would have started owning the same thing.
 */
public record BlockDiagram(
        String id,
        String name,
        String summary,
        String revision,
        WorkStatus status,
        String updatedLabel) {
}
