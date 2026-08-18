package com.arrow.dws.application.artifact;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.Visibility;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Works out which artifacts a design has.
 *
 * <p>Artifacts are derived, not stored: one PNG per block diagram, a
 * spreadsheet for the parts list and another for the query log, a PDF per
 * document, and a PDF summary of the design as a whole. Deriving them in one
 * place means the list endpoint and the download endpoint can never disagree
 * about what exists.
 *
 * <p>Visibility is inherited from the source. A document that is internal
 * produces an internal artifact; the query log carries whatever the queries
 * themselves would.
 */
@Component
public class ArtifactCatalogue {

    /** Every artifact this design has, for this audience, in display order. */
    public List<Artifact> artifactsFor(Design design, Audience audience) {
        return all(design).stream().filter(a -> a.visibleTo(audience)).toList();
    }

    /** One artifact by id, or empty — the download endpoint's lookup. */
    public java.util.Optional<Artifact> find(Design design, Audience audience, String artifactId) {
        return artifactsFor(design, audience).stream()
                .filter(a -> a.id().equals(artifactId))
                .findFirst();
    }

    private List<Artifact> all(Design design) {
        List<Artifact> artifacts = new ArrayList<>();

        // The summary first: it is the thing to open if you only open one.
        artifacts.add(new Artifact(
                "summary",
                fileName(design.id() + " summary", ArtifactKind.DESIGN_SUMMARY),
                "Design summary",
                "Overview, diagrams, supply risk and open questions",
                ArtifactKind.DESIGN_SUMMARY,
                Visibility.CUSTOMER_VISIBLE,
                design.id()));

        design.diagrams().forEach(diagram -> artifacts.add(new Artifact(
                "diagram-" + diagram.id(),
                fileName(diagram.name(), ArtifactKind.BLOCK_DIAGRAM),
                diagram.name(),
                diagram.revision() + " · " + diagram.status().label(),
                ArtifactKind.BLOCK_DIAGRAM,
                // A diagram still being reworked is not something to hand a
                // customer; an approved one is.
                diagram.status() == com.arrow.dws.domain.model.WorkStatus.APPROVED
                        ? Visibility.CUSTOMER_VISIBLE
                        : Visibility.INTERNAL,
                diagram.id())));

        if (!design.parts().isEmpty()) {
            artifacts.add(new Artifact(
                    "bill-of-materials",
                    fileName(design.id() + " bill of materials", ArtifactKind.BILL_OF_MATERIALS),
                    "Bill of materials",
                    design.parts().size() + " parts",
                    ArtifactKind.BILL_OF_MATERIALS,
                    Visibility.CUSTOMER_VISIBLE,
                    design.id()));
        }

        if (!design.queries().isEmpty()) {
            artifacts.add(new Artifact(
                    "query-log",
                    fileName(design.id() + " query log", ArtifactKind.QUERY_LOG),
                    "Query log",
                    design.openQueries().size() + " open of " + design.queries().size(),
                    ArtifactKind.QUERY_LOG,
                    // Internal: the questions an FAE is still chasing are not
                    // a customer-facing document.
                    Visibility.INTERNAL,
                    design.id()));
        }

        design.documents().forEach(document -> artifacts.add(new Artifact(
                "document-" + slug(document.name()),
                fileName(stripExtension(document.name()), ArtifactKind.DOCUMENT),
                stripExtension(document.name()),
                document.kind() + " · " + document.sizeLabel(),
                ArtifactKind.DOCUMENT,
                document.visibility(),
                document.name())));

        return artifacts;
    }

    /** Human-readable, with the extension the format actually is. */
    private static String fileName(String title, ArtifactKind kind) {
        return title.replaceAll("[^A-Za-z0-9 ._-]", "").trim() + "." + kind.format().extension();
    }

    private static String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot <= 0 ? name : name.substring(0, dot);
    }

    /** Lower-case and hyphenated — an id that is safe in a URL. */
    private static String slug(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
