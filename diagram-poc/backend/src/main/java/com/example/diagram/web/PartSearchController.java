package com.example.diagram.web;

import com.example.diagram.service.PartSearchService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Parts search proxy. The frontend calls this (authenticated) instead of Arrow
 * directly, so the OAuth credentials stay server-side. Returns the raw
 * partserviceresult JSON.
 */
@RestController
@RequestMapping("/api")
public class PartSearchController {

    private final PartSearchService parts;

    public PartSearchController(PartSearchService parts) {
        this.parts = parts;
    }

    @GetMapping(value = "/parts/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> search(@RequestParam("q") String query,
                                         @RequestParam(value = "supplier", required = false) String supplier,
                                         @RequestParam(value = "dw", required = false, defaultValue = "false") boolean designWin) {
        return ResponseEntity.ok(parts.search(query, supplier, designWin));
    }
}
