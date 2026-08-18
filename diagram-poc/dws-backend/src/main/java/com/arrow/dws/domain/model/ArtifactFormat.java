package com.arrow.dws.domain.model;

/**
 * The file format an artifact is delivered in.
 *
 * <p>Deliberately a closed set. Every artifact leaves this service as a PNG, a
 * PDF or a spreadsheet — a customer opens all three without installing
 * anything, and a fixed set means the download endpoint can state its
 * media type from the model instead of guessing from a filename.
 */
public enum ArtifactFormat {

    PNG("image/png", "png", "Image"),
    PDF("application/pdf", "pdf", "PDF"),
    XLSX("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx", "Spreadsheet");

    private final String mediaType;
    private final String extension;
    private final String label;

    ArtifactFormat(String mediaType, String extension, String label) {
        this.mediaType = mediaType;
        this.extension = extension;
        this.label = label;
    }

    public String mediaType() {
        return mediaType;
    }

    public String extension() {
        return extension;
    }

    public String label() {
        return label;
    }

    /** Whether a browser will show this inline rather than only download it. */
    public boolean rendersInline() {
        return this != XLSX;
    }
}
