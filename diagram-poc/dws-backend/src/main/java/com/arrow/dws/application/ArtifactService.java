package com.arrow.dws.application;

import com.arrow.dws.api.dto.ArtifactListView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.RenderedArtifact;

/**
 * Listing and downloading a design's artifacts.
 *
 * <p>Two operations because they cost different things: listing is metadata and
 * must stay cheap; downloading produces a file. A single "give me everything
 * with the bytes" call would make every list request pay for every download.
 */
public interface ArtifactService {

    /**
     * Every artifact this audience may see, with size and download URL — but
     * not the bytes.
     *
     * @throws com.arrow.dws.api.error.NotFoundException when no design is
     *         linked to that opportunity
     */
    ArtifactListView listArtifacts(String opportunityId, Audience audience);

    /**
     * One artifact, with its bytes.
     *
     * @throws com.arrow.dws.api.error.NotFoundException when the opportunity or
     *         the artifact is unknown <em>to this audience</em> — an artifact
     *         the caller may not see is reported as absent, not as forbidden,
     *         because "it exists but not for you" is itself a disclosure
     */
    RenderedArtifact downloadArtifact(String opportunityId, Audience audience, String artifactId);
}
