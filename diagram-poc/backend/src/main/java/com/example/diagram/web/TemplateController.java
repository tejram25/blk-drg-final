package com.example.diagram.web;

import com.example.diagram.service.TemplateService;
import com.example.diagram.web.dto.TemplateDetail;
import com.example.diagram.web.dto.TemplateRatingRequest;
import com.example.diagram.web.dto.TemplateRequest;
import com.example.diagram.web.dto.TemplateSummary;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The shared template repository: browse, search, use, improve, rate and publish
 * templates. Thin — delegates to {@link TemplateService}. The author/editor/rater
 * is taken from the authenticated session, never from the request body.
 */
@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService templates;

    public TemplateController(TemplateService templates) {
        this.templates = templates;
    }

    @GetMapping
    public List<TemplateSummary> list(Authentication auth) {
        return templates.listAll(email(auth));
    }

    @GetMapping("/{id}")
    public TemplateDetail get(@PathVariable Long id, Authentication auth) {
        return templates.get(id, email(auth));
    }

    /** Use a template to start a diagram (returns its content and bumps usage). */
    @PostMapping("/{id}/use")
    public TemplateDetail use(@PathVariable Long id, Authentication auth) {
        return templates.use(id, email(auth));
    }

    /** Rate a template 1-5 stars (create or update the caller's rating). */
    @PostMapping("/{id}/rating")
    public TemplateDetail rate(@PathVariable Long id,
                               @RequestBody TemplateRatingRequest request,
                               Authentication auth) {
        int stars = request.rating() == null ? 0 : request.rating();
        return templates.rate(id, stars, email(auth));
    }

    /** Publish the current canvas as a new template. */
    @PostMapping
    public ResponseEntity<TemplateDetail> create(@RequestBody TemplateRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(templates.create(request, email(auth)));
    }

    /** Improve an existing template in place. */
    @PutMapping("/{id}")
    public TemplateDetail update(@PathVariable Long id, @RequestBody TemplateRequest request, Authentication auth) {
        return templates.update(id, request, email(auth));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        templates.delete(id);
        return ResponseEntity.noContent().build();
    }

    private String email(Authentication auth) {
        return auth == null ? null : auth.getName();
    }
}
