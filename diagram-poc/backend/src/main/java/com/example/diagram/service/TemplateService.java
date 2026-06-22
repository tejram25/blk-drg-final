package com.example.diagram.service;

import com.example.diagram.web.dto.TemplateDetail;
import com.example.diagram.web.dto.TemplateRequest;
import com.example.diagram.web.dto.TemplateSummary;
import com.example.diagram.web.dto.ReviewRequest;
import com.example.diagram.web.dto.ReviewResponse;

import java.util.List;

/**
 * The shared template repository. Controllers depend on this abstraction, not
 * on JPA. The author/editor identity is supplied by the controller as the
 * authenticated email; the display name is resolved server-side, so it's never
 * trusted from the request body. The viewer's email is used to surface their
 * own rating ({@code myRating}) on each template.
 */
public interface TemplateService {

    List<TemplateSummary> listAll(String viewerEmail);

    TemplateDetail get(Long id, String viewerEmail);

    /** Publish the current canvas as a new template. */
    TemplateDetail create(TemplateRequest request, String authorEmail);

    /** Improve an existing template in place; records who last edited it. */
    TemplateDetail update(Long id, TemplateRequest request, String editorEmail);

    /** Fetch a template's content and increment its usage count. */
    TemplateDetail use(Long id, String viewerEmail);

    /** Create or update the viewer's 1-5 star rating of a template (quick rate). */
    TemplateDetail rate(Long id, int stars, String viewerEmail);

    /** Aggregate review data for a template (average, distribution, mine, list). */
    ReviewResponse getReviews(Long id, String viewerEmail);

    /** Create or update the viewer's full review (rating + comment) of a template. */
    ReviewResponse submitReview(Long id, ReviewRequest request, String viewerEmail);

    void delete(Long id);
}
