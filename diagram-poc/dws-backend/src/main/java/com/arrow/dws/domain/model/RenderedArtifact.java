package com.arrow.dws.domain.model;

/**
 * An artifact with its bytes.
 *
 * <p>Separate from {@link Artifact} because the metadata is cheap and the bytes
 * are not: listing artifacts should never render them, and the type system is
 * a better reminder of that than a comment.
 */
public record RenderedArtifact(Artifact artifact, byte[] content) {

    public RenderedArtifact {
        content = content.clone();
    }

    @Override
    public byte[] content() {
        return content.clone();
    }

    public int sizeBytes() {
        return content.length;
    }
}
