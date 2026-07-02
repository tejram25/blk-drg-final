package com.example.diagram.web;

import com.example.diagram.service.ImageDiagramService;
import com.example.diagram.web.dto.ImageDiagramRequest;
import com.example.diagram.web.dto.ImageDiagramResult;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Turns an uploaded diagram image into an editable block diagram. */
@RestController
@RequestMapping("/api/image-to-diagram")
public class ImageDiagramController {

    private final ImageDiagramService service;

    public ImageDiagramController(ImageDiagramService service) {
        this.service = service;
    }

    @PostMapping
    public ImageDiagramResult extract(@RequestBody ImageDiagramRequest request) {
        return service.extract(request == null ? null : request.image());
    }
}
