package com.example.diagram.service.impl;

import com.example.diagram.domain.Template;
import com.example.diagram.domain.TemplateRating;
import com.example.diagram.domain.User;
import com.example.diagram.repository.TemplateRatingRepository;
import com.example.diagram.repository.TemplateRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.service.TemplateService;
import com.example.diagram.web.dto.ReviewItemDto;
import com.example.diagram.web.dto.ReviewRequest;
import com.example.diagram.web.dto.ReviewResponse;
import com.example.diagram.web.dto.TemplateDetail;
import com.example.diagram.web.dto.TemplateRequest;
import com.example.diagram.web.dto.TemplateSummary;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TemplateServiceImpl implements TemplateService {

    private final TemplateRepository repository;
    private final TemplateRatingRepository ratings;
    private final UserRepository users;

    public TemplateServiceImpl(TemplateRepository repository,
                               TemplateRatingRepository ratings,
                               UserRepository users) {
        this.repository = repository;
        this.ratings = ratings;
        this.users = users;
    }

    @Override
    public List<TemplateSummary> listAll(String viewerEmail) {
        Map<Long, List<TemplateRating>> byTemplate = ratings.findAll().stream()
                .collect(Collectors.groupingBy(TemplateRating::getTemplateId));
        return repository.findAllByOrderByUsageCountDescUpdatedAtDesc().stream()
                .map(t -> toSummary(t, byTemplate.getOrDefault(t.getId(), List.of()), viewerEmail))
                .toList();
    }

    @Override
    public TemplateDetail get(Long id, String viewerEmail) {
        return toDetail(require(id), viewerEmail);
    }

    @Override
    public TemplateDetail create(TemplateRequest request, String authorEmail) {
        validate(request);
        Template template = new Template();
        apply(template, request);
        template.setAuthorEmail(authorEmail);
        template.setAuthorName(displayName(authorEmail));
        return toDetail(repository.save(template), authorEmail);
    }

    @Override
    public TemplateDetail update(Long id, TemplateRequest request, String editorEmail) {
        validate(request);
        Template template = require(id);
        apply(template, request);
        template.setUpdatedByName(displayName(editorEmail));
        return toDetail(repository.save(template), editorEmail);
    }

    @Override
    public TemplateDetail use(Long id, String viewerEmail) {
        Template template = require(id);
        template.setUsageCount(template.getUsageCount() + 1);
        return toDetail(repository.save(template), viewerEmail);
    }

    @Override
    public TemplateDetail rate(Long id, int stars, String viewerEmail) {
        if (stars < 1 || stars > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5.");
        }
        Template template = require(id);
        if (viewerEmail == null || viewerEmail.isBlank()) {
            throw new IllegalArgumentException("You must be signed in to rate a template.");
        }
        TemplateRating rating = upsert(id, viewerEmail);
        rating.setRating(stars);
        rating.setUserName(displayName(viewerEmail));
        ratings.save(rating);
        return toDetail(template, viewerEmail);
    }

    @Override
    public ReviewResponse getReviews(Long id, String viewerEmail) {
        require(id);
        return aggregate(id, viewerEmail);
    }

    @Override
    public ReviewResponse submitReview(Long id, ReviewRequest request, String viewerEmail) {
        require(id);
        if (viewerEmail == null || viewerEmail.isBlank()) {
            throw new IllegalArgumentException("You must be signed in to review a template.");
        }
        int stars = request.rating() == null ? 0 : request.rating();
        if (stars < 1 || stars > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5.");
        }
        TemplateRating rating = upsert(id, viewerEmail);
        rating.setRating(stars);
        rating.setUserName(displayName(viewerEmail));
        rating.setComment(trimComment(request.comment()));
        ratings.save(rating);
        return aggregate(id, viewerEmail);
    }

    @Override
    public void delete(Long id) {
        ratings.findByTemplateId(id).forEach(ratings::delete);
        repository.deleteById(id);
    }

    /** Find the caller's existing rating row, or a new one stamped with identity. */
    private TemplateRating upsert(Long templateId, String email) {
        return ratings.findByTemplateIdAndUserEmail(templateId, email)
                .orElseGet(() -> {
                    TemplateRating r = new TemplateRating();
                    r.setTemplateId(templateId);
                    r.setUserEmail(email);
                    return r;
                });
    }

    /** Build ReviewResponse (reused from the diagram reviews) from rating rows. */
    private ReviewResponse aggregate(Long templateId, String email) {
        List<TemplateRating> list = ratings.findByTemplateId(templateId).stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .toList();
        int sum = 0;
        Map<String, Integer> dist = new LinkedHashMap<>();
        for (int s = 5; s >= 1; s--) {
            dist.put(String.valueOf(s), 0);
        }
        List<ReviewItemDto> items = new ArrayList<>();
        ReviewResponse.Mine mine = null;
        for (TemplateRating r : list) {
            sum += r.getRating();
            dist.merge(String.valueOf(r.getRating()), 1, Integer::sum);
            boolean self = email != null && email.equalsIgnoreCase(r.getUserEmail());
            String name = r.getUserName() != null && !r.getUserName().isBlank()
                    ? r.getUserName() : displayName(r.getUserEmail());
            items.add(new ReviewItemDto(name, r.getRating(),
                    r.getComment() == null ? "" : r.getComment(), r.getUpdatedAt(), self));
            if (self) {
                mine = new ReviewResponse.Mine(r.getRating(), r.getComment() == null ? "" : r.getComment());
            }
        }
        int count = list.size();
        double avg = count == 0 ? 0.0 : Math.round((double) sum / count * 10.0) / 10.0;
        return new ReviewResponse(avg, count, dist, mine, items);
    }

    private String trimComment(String comment) {
        if (comment == null) return "";
        String t = comment.trim();
        return t.length() > 2000 ? t.substring(0, 2000) : t;
    }

    // --- helpers ---

    private void validate(TemplateRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("Template name is required.");
        }
        if (request.contentJson() == null || request.contentJson().isBlank()) {
            throw new IllegalArgumentException("Template content is required.");
        }
    }

    private void apply(Template template, TemplateRequest request) {
        template.setName(request.name().trim());
        template.setDescription(trimToNull(request.description()));
        template.setCategory(trimToNull(request.category()));
        template.setContentJson(request.contentJson());
    }

    private Template require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Template not found"));
    }

    /** Resolve a user's display name from their email, falling back to the email. */
    private String displayName(String email) {
        if (email == null) return null;
        return users.findByEmail(email)
                .map(User::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElse(email);
    }

    private TemplateSummary toSummary(Template t, List<TemplateRating> rs, String viewerEmail) {
        return new TemplateSummary(t.getId(), t.getName(), t.getDescription(), t.getCategory(),
                t.getAuthorName(), t.getUpdatedByName(), t.getUsageCount(),
                average(rs), rs.size(), myRating(rs, viewerEmail), t.getUpdatedAt());
    }

    private TemplateDetail toDetail(Template t, String viewerEmail) {
        List<TemplateRating> rs = ratings.findByTemplateId(t.getId());
        return new TemplateDetail(t.getId(), t.getName(), t.getDescription(), t.getCategory(),
                t.getContentJson(), t.getAuthorName(), t.getUpdatedByName(), t.getUsageCount(),
                average(rs), rs.size(), myRating(rs, viewerEmail), t.getCreatedAt(), t.getUpdatedAt());
    }

    private double average(List<TemplateRating> rs) {
        if (rs.isEmpty()) return 0.0;
        double avg = rs.stream().mapToInt(TemplateRating::getRating).average().orElse(0.0);
        return Math.round(avg * 10.0) / 10.0;
    }

    private int myRating(List<TemplateRating> rs, String viewerEmail) {
        if (viewerEmail == null) return 0;
        return rs.stream()
                .filter(r -> viewerEmail.equalsIgnoreCase(r.getUserEmail()))
                .findFirst()
                .map(TemplateRating::getRating)
                .orElse(0);
    }

    private String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
