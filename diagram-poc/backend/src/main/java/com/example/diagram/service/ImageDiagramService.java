package com.example.diagram.service;

import com.example.diagram.web.dto.ImageDiagramResult;

/** Extracts an editable block diagram from an uploaded diagram image. */
public interface ImageDiagramService {

    /**
     * Analyse a diagram image and return the blocks + connections it contains.
     *
     * @param imageData a data URL or bare base64 image string
     */
    ImageDiagramResult extract(String imageData);
}
