package com.example.diagram.service;

import com.example.diagram.web.dto.TemplateDetail;
import com.example.diagram.web.dto.TemplateRequest;
import com.example.diagram.web.dto.TemplateSummary;

import java.util.List;

/**
 * The shared template repository. Controllers depend on this abstraction, not
 * on JPA. The author/editor identity is supplied by the controller as the
 * authenticated email; the display name is resolved server-side, so it's never
 * trusted from the request body.
 */
public interface TemplateService {

    List<TemplateSummary> listAll();

    TemplateDetail get(Long id);

    /** Publish the current canvas as a new template. */
    TemplateDetail create(TemplateRequest request, String authorEmail);

    /** Improve an existing template in place; records who last edited it. */
    TemplateDetail update(Long id, TemplateRequest request, String editorEmail);

    /** Fetch a template's content and increment its usage count. */
    TemplateDetail use(Long id);

    void delete(Long id);
}
