package com.arrow.dws.application;

import com.arrow.dws.api.dto.ArtifactListView;
import com.arrow.dws.api.dto.ArtifactView;
import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.error.NotFoundException;
import com.arrow.dws.application.artifact.ArtifactCatalogue;
import com.arrow.dws.application.artifact.ArtifactRendererRegistry;
import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.RenderedArtifact;
import com.arrow.dws.domain.model.Tone;
import com.arrow.dws.domain.port.DesignRepository;

import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

/**
 * Finds the design, asks the catalogue what artifacts it has, renders each.
 *
 * <p><b>On rendering during a list.</b> {@code sizeBytes} is the real size, so
 * the list renders every artifact to measure it. That is honest but wasteful,
 * and it is only acceptable because the POC's data is a fixture: a handful of
 * small files, tens of milliseconds. A real implementation stores the bytes
 * when the artifact is produced and reads the size from metadata, at which
 * point this method stops rendering entirely. Returning a guessed or absent
 * size instead would be cheaper and worse — a download UI that says "2.4 MB"
 * and then delivers 40 KB has told the user something false.
 */
@Service
public class DefaultArtifactService implements ArtifactService {

    private final DesignRepository designs;
    private final ArtifactCatalogue catalogue;
    private final ArtifactRendererRegistry renderers;
    private final Clock clock;

    public DefaultArtifactService(DesignRepository designs,
                                  ArtifactCatalogue catalogue,
                                  ArtifactRendererRegistry renderers,
                                  Clock clock) {
        this.designs = designs;
        this.catalogue = catalogue;
        this.renderers = renderers;
        this.clock = clock;
    }

    @Override
    public ArtifactListView listArtifacts(String opportunityId, Audience audience) {
        Design design = requireDesign(opportunityId);

        List<ArtifactView> views = new ArrayList<>();
        long total = 0;
        for (Artifact artifact : catalogue.artifactsFor(design, audience)) {
            int size = renderers.render(design, artifact).sizeBytes();
            total += size;
            views.add(toView(opportunityId, artifact, size));
        }

        return new ArtifactListView(
                opportunityId, design.id(), design.name(), design.customer(),
                audience.name().toLowerCase(), views.size(), total,
                clock.instant(), views);
    }

    @Override
    public RenderedArtifact downloadArtifact(String opportunityId, Audience audience, String artifactId) {
        Design design = requireDesign(opportunityId);
        Artifact artifact = catalogue.find(design, audience, artifactId)
                .orElseThrow(() -> new NotFoundException(
                        "No artifact " + artifactId + " on opportunity " + opportunityId));
        return renderers.render(design, artifact);
    }

    private Design requireDesign(String opportunityId) {
        return designs.findByOpportunityId(opportunityId)
                .orElseThrow(() -> new NotFoundException(
                        "No design is linked to opportunity " + opportunityId));
    }

    private ArtifactView toView(String opportunityId, Artifact artifact, int sizeBytes) {
        return new ArtifactView(
                artifact.id(),
                artifact.fileName(),
                artifact.title(),
                artifact.description(),
                artifact.kind().name(),
                artifact.kind().label(),
                artifact.format().extension(),
                artifact.format().mediaType(),
                sizeBytes,
                artifact.format().rendersInline(),
                downloadUrl(opportunityId, artifact.id()),
                List.of(
                        FieldView.of("kind", "Kind", artifact.kind().label()),
                        FieldView.of("format", "Format", artifact.format().label(), Tone.INFO),
                        FieldView.of("size", "Size", humanSize(sizeBytes))));
    }

    /** Relative, so the URL is correct behind any host or reverse proxy. */
    private static String downloadUrl(String opportunityId, String artifactId) {
        return "/api/sfdc/opportunities/" + encode(opportunityId) + "/artifacts/" + encode(artifactId);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    /** Sizes people read, not sizes machines read. */
    private static String humanSize(int bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }
        if (bytes < 1024 * 1024) {
            return Math.round(bytes / 1024.0) + " KB";
        }
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }
}
