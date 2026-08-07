package com.arrow.dws.application.artifact;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.RenderedArtifact;
import com.arrow.dws.domain.port.ArtifactRenderer;

import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Routes an artifact to the renderer that handles its kind.
 *
 * <p>Fails at <b>startup</b> if a kind has no renderer or has two. A kind added
 * without a renderer would otherwise appear in the list endpoint and 500 on
 * download — a defect that only shows up when someone clicks the thing, which
 * is exactly the kind of gap a POC ships with.
 */
@Component
public class ArtifactRendererRegistry {

    private final Map<ArtifactKind, ArtifactRenderer> byKind = new EnumMap<>(ArtifactKind.class);

    public ArtifactRendererRegistry(List<ArtifactRenderer> renderers) {
        for (ArtifactRenderer renderer : renderers) {
            ArtifactRenderer clash = byKind.put(renderer.handles(), renderer);
            if (clash != null) {
                throw new IllegalStateException("Two renderers claim " + renderer.handles() + ": "
                        + clash.getClass().getSimpleName() + " and " + renderer.getClass().getSimpleName());
            }
        }
        List<ArtifactKind> unhandled = java.util.Arrays.stream(ArtifactKind.values())
                .filter(kind -> !byKind.containsKey(kind))
                .toList();
        if (!unhandled.isEmpty()) {
            throw new IllegalStateException("No ArtifactRenderer for " + unhandled
                    + ". Every kind needs one, or it will 500 on download.");
        }
    }

    /** Render an artifact. The kind is guaranteed to have a renderer. */
    public RenderedArtifact render(Design design, Artifact artifact) {
        ArtifactRenderer renderer = byKind.get(artifact.kind());
        return new RenderedArtifact(artifact, renderer.render(design, artifact));
    }
}
