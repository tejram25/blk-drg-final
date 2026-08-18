package com.arrow.dws.domain.port;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Design;

/**
 * Turns an artifact into bytes.
 *
 * <p><b>The extension point for formats.</b> Supporting a new kind of artifact
 * is a new implementation carrying {@code @Component}; the registry finds it by
 * {@link #handles()} and nothing else changes. The same shape as
 * {@code TabContributor}, for the same reason.
 *
 * <p>An implementation owns exactly one kind. That keeps the image code out of
 * the spreadsheet code, and it means a broken PDF cannot take the diagrams
 * down with it.
 */
public interface ArtifactRenderer {

    /** The kind this renderer produces. */
    ArtifactKind handles();

    /**
     * Produce the file.
     *
     * @param design   the design the artifact belongs to — the source of truth
     * @param artifact what to render; {@code artifact.sourceId()} says which
     *                 diagram or document
     */
    byte[] render(Design design, Artifact artifact);
}
