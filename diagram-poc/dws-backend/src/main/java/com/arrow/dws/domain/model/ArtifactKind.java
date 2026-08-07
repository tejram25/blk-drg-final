package com.arrow.dws.domain.model;

/**
 * What an artifact <em>is</em>, and therefore the format it comes out as.
 *
 * <p>The mapping lives here rather than being decided per call site, so
 * "diagrams are images, tables are spreadsheets, everything else is a PDF" is
 * stated once. Adding a kind forces a format decision at the point of adding.
 */
public enum ArtifactKind {

    /** A block diagram, rendered as an image so it can be shown inline. */
    BLOCK_DIAGRAM("Block diagram", ArtifactFormat.PNG),

    /** The parts list — tabular, so a spreadsheet someone can actually work in. */
    BILL_OF_MATERIALS("Bill of materials", ArtifactFormat.XLSX),

    /** The open questions against the design. Also tabular. */
    QUERY_LOG("Query log", ArtifactFormat.XLSX),

    /** A document filed against the design. */
    DOCUMENT("Document", ArtifactFormat.PDF),

    /** The one-page summary of the design as a whole. */
    DESIGN_SUMMARY("Design summary", ArtifactFormat.PDF);

    private final String label;
    private final ArtifactFormat format;

    ArtifactKind(String label, ArtifactFormat format) {
        this.label = label;
        this.format = format;
    }

    public String label() {
        return label;
    }

    public ArtifactFormat format() {
        return format;
    }
}
