package com.arrow.dws.domain.model;

/**
 * One downloadable file belonging to a design.
 *
 * <p>Artifacts are <b>derived</b>, not stored: a diagram becomes a PNG, the
 * parts list becomes a spreadsheet, a document becomes a PDF. The record says
 * what should exist and where it came from; producing the bytes is a separate
 * concern, so nothing here has to know about image or document libraries.
 *
 * @param id          stable, and safe in a URL — it addresses the download
 * @param fileName    what the file is called when it lands on a disk
 * @param title       display name, without the extension
 * @param description one line of context, or null
 * @param kind        what it is; the kind decides the format
 * @param visibility  whether it may leave Arrow
 * @param sourceId    the diagram id or document name it was derived from
 */
public record Artifact(
        String id,
        String fileName,
        String title,
        String description,
        ArtifactKind kind,
        Visibility visibility,
        String sourceId) {

    public ArtifactFormat format() {
        return kind.format();
    }

    /** Whether this artifact may be shown to the given audience. */
    public boolean visibleTo(Audience audience) {
        return visibility.visibleTo(audience);
    }
}
