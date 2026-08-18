package com.arrow.dws.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Every artifact for one opportunity.
 *
 * <p>Header fields mirror the tabs API so a client that already renders one can
 * render the other without a second vocabulary.
 */
public record ArtifactListView(
        String opportunityId,
        String designId,
        String name,
        String customer,
        String audience,
        int artifactCount,
        long totalSizeBytes,
        Instant generatedAt,
        List<ArtifactView> artifacts) {

    public ArtifactListView {
        artifacts = List.copyOf(artifacts);
    }
}
