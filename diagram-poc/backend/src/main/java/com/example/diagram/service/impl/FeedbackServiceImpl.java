package com.example.diagram.service.impl;

import com.example.diagram.domain.Feedback;
import com.example.diagram.repository.FeedbackRepository;
import com.example.diagram.service.FeedbackService;
import com.example.diagram.web.dto.FeedbackRequest;
import com.example.diagram.web.dto.FeedbackResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FeedbackServiceImpl implements FeedbackService {

    private final FeedbackRepository repository;

    public FeedbackServiceImpl(FeedbackRepository repository) {
        this.repository = repository;
    }

    @Override
    public FeedbackResponse submit(FeedbackRequest request, String userEmail) {
        String message = request.message() == null ? "" : request.message().trim();
        if (message.isEmpty() && request.rating() <= 0) {
            throw new IllegalArgumentException("Add a rating or a message before submitting feedback.");
        }
        Feedback f = new Feedback();
        f.setCategory(category(request.category()));
        f.setRating(Math.max(0, Math.min(5, request.rating())));
        f.setMessage(message);
        f.setUserEmail(userEmail);
        f.setDiagramId(request.diagramId());
        return toResponse(repository.save(f));
    }

    @Override
    public List<FeedbackResponse> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    private String category(String raw) {
        return (raw == null || raw.isBlank()) ? "general" : raw.trim().toLowerCase();
    }

    private FeedbackResponse toResponse(Feedback f) {
        return new FeedbackResponse(f.getId(), f.getCategory(), f.getRating(), f.getMessage(),
                f.getUserEmail(), f.getDiagramId(), f.getCreatedAt());
    }
}
