package com.example.diagram.web;

import com.example.diagram.service.BoxSuggestionService;
import com.example.diagram.web.dto.BoxSuggestionRequest;
import com.example.diagram.web.dto.BoxSuggestionResult;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Suggests the component a diagram box needs (catalogue + Design Win POS). */
@RestController
@RequestMapping("/api/box-suggestions")
public class BoxSuggestionController {

    private final BoxSuggestionService service;

    public BoxSuggestionController(BoxSuggestionService service) {
        this.service = service;
    }

    @PostMapping
    public BoxSuggestionResult suggest(@RequestBody BoxSuggestionRequest req) {
        if (req == null) return new BoxSuggestionResult("", java.util.List.of(), "No box provided.");
        return service.suggest(req);
    }
}
