package com.arrow.dws.api.dto;

import java.util.List;

/**
 * One downloadable artifact, as metadata.
 *
 * <p>No bytes: base64 in a list would inflate a multi-megabyte response for a
 * client that only wants to draw a row per file. {@code downloadUrl} is where
 * the bytes are, and for a PNG it can go straight into an {@code <img src>}.
 *
 * @param id           stable identifier, safe in a URL
 * @param fileName     what the file is called when saved
 * @param title        display name, without the extension
 * @param description  one line of context, or null
 * @param kind         BLOCK_DIAGRAM · BILL_OF_MATERIALS · QUERY_LOG · DOCUMENT · DESIGN_SUMMARY
 * @param kindLabel    the human form of the kind
 * @param format       png · pdf · xlsx
 * @param mediaType    the Content-Type the download will carry
 * @param sizeBytes    exact size of the file the download returns
 * @param inline       whether a browser will display it rather than only save it
 * @param downloadUrl  where to fetch the bytes
 * @param fields       the same key/value shape the tabs API uses
 */
public record ArtifactView(
        String id,
        String fileName,
        String title,
        String description,
        String kind,
        String kindLabel,
        String format,
        String mediaType,
        int sizeBytes,
        boolean inline,
        String downloadUrl,
        List<FieldView> fields) {

    public ArtifactView {
        fields = List.copyOf(fields);
    }
}
