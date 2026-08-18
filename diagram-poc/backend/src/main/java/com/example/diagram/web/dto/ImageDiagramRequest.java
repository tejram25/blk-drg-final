package com.example.diagram.web.dto;

/**
 * Request to extract a block diagram from an image. {@code image} is a data URL
 * ({@code data:image/png;base64,...}) or a bare base64 string produced by the
 * browser's FileReader.
 */
public record ImageDiagramRequest(String image) {
}
