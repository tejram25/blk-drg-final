package com.example.diagram.service.impl;

import com.example.diagram.domain.Template;
import com.example.diagram.domain.User;
import com.example.diagram.repository.TemplateRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.service.TemplateService;
import com.example.diagram.web.dto.TemplateDetail;
import com.example.diagram.web.dto.TemplateRequest;
import com.example.diagram.web.dto.TemplateSummary;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TemplateServiceImpl implements TemplateService {

    private final TemplateRepository repository;
    private final UserRepository users;

    public TemplateServiceImpl(TemplateRepository repository, UserRepository users) {
        this.repository = repository;
        this.users = users;
    }

    @Override
    public List<TemplateSummary> listAll() {
        return repository.findAllByOrderByUsageCountDescUpdatedAtDesc().stream()
                .map(this::toSummary)
                .toList();
    }

    @Override
    public TemplateDetail get(Long id) {
        return toDetail(require(id));
    }

    @Override
    public TemplateDetail create(TemplateRequest request, String authorEmail) {
        validate(request);
        Template template = new Template();
        apply(template, request);
        template.setAuthorEmail(authorEmail);
        template.setAuthorName(displayName(authorEmail));
        return toDetail(repository.save(template));
    }

    @Override
    public TemplateDetail update(Long id, TemplateRequest request, String editorEmail) {
        validate(request);
        Template template = require(id);
        apply(template, request);
        template.setUpdatedByName(displayName(editorEmail));
        return toDetail(repository.save(template));
    }

    @Override
    public TemplateDetail use(Long id) {
        Template template = require(id);
        template.setUsageCount(template.getUsageCount() + 1);
        return toDetail(repository.save(template));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
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

    private TemplateSummary toSummary(Template t) {
        return new TemplateSummary(t.getId(), t.getName(), t.getDescription(), t.getCategory(),
                t.getAuthorName(), t.getUpdatedByName(), t.getUsageCount(), t.getUpdatedAt());
    }

    private TemplateDetail toDetail(Template t) {
        return new TemplateDetail(t.getId(), t.getName(), t.getDescription(), t.getCategory(),
                t.getContentJson(), t.getAuthorName(), t.getUpdatedByName(), t.getUsageCount(),
                t.getCreatedAt(), t.getUpdatedAt());
    }

    private String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
