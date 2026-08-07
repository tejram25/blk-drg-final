package com.arrow.dws.adapter.render;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.LifecycleStage;
import com.arrow.dws.domain.port.ArtifactRenderer;

import org.springframework.stereotype.Component;

/** The one-page summary of the design: what it is, where it is, what is open. */
@Component
public class DesignSummaryPdfRenderer extends PdfWriter implements ArtifactRenderer {

    @Override
    public ArtifactKind handles() {
        return ArtifactKind.DESIGN_SUMMARY;
    }

    @Override
    public byte[] render(Design design, Artifact artifact) {
        return document(design, artifact, page -> {
            page.heading("Overview", 13);
            page.paragraph(design.brief());
            page.blank();

            page.pair("Customer", design.customer());
            page.pair("Region", design.region());
            page.pair("Owner", design.owner());
            page.pair("Stage", design.stage().label()
                    + " (" + design.stage().position() + " of " + LifecycleStage.count() + ")");
            page.pair("Timeline", design.startDate() + " to " + design.targetEndDate());
            page.pair("Estimated value", design.estimatedValueLabel());
            page.blank();
            page.rule();

            page.heading("Block diagrams", 13);
            if (design.diagrams().isEmpty()) {
                page.line("None yet.");
            } else {
                design.diagrams().forEach(d -> {
                    try {
                        page.pair(d.name(), d.revision() + " · " + d.status().label());
                    } catch (Exception ex) {
                        throw new IllegalStateException("Could not write diagram row", ex);
                    }
                });
            }
            page.blank();
            page.rule();

            page.heading("Supply risk", 13);
            var atRisk = design.partsAtRisk();
            if (atRisk.isEmpty()) {
                page.line("Every part on this design is in full production.");
            } else {
                page.paragraph(atRisk.size() + (atRisk.size() == 1 ? " part is" : " parts are")
                        + " not in full production:");
                page.bullets(atRisk.stream()
                        .map(p -> p.manufacturerPartNumber() + " (" + p.lifecycle().label()
                                + ", lead time " + p.leadTimeLabel() + ")")
                        .toList());
            }
            page.blank();
            page.rule();

            page.heading("Open questions", 13);
            var open = design.openQueries();
            if (open.isEmpty()) {
                page.line("None outstanding.");
            } else {
                page.bullets(open.stream()
                        .map(q -> q.reference() + " — " + q.subject() + " (" + q.ageLabel() + ")")
                        .toList());
            }
        });
    }
}
