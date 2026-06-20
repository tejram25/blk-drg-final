package com.example.diagram.service.impl;

import com.example.diagram.domain.Review;
import com.example.diagram.domain.User;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.ReviewRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.service.ReviewService;
import com.example.diagram.web.dto.ReviewItemDto;
import com.example.diagram.web.dto.ReviewRequest;
import com.example.diagram.web.dto.ReviewResponse;
import com.example.diagram.web.dto.ReviewSummaryDto;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReviewServiceImpl implements ReviewService {

    private static final int MAX_COMMENT_LENGTH = 2000;

    private final ReviewRepository reviews;
    private final DiagramRepository diagrams;
    private final UserRepository users;

    public ReviewServiceImpl(ReviewRepository reviews, DiagramRepository diagrams, UserRepository users) {
        this.reviews = reviews;
        this.diagrams = diagrams;
        this.users = users;
    }

    @Override
    public ReviewResponse getForDiagram(Long diagramId, String userEmail) {
        return aggregate(diagramId, userEmail);
    }

    @Override
    public ReviewResponse submit(Long diagramId, ReviewRequest request, String userEmail) {
        if (!diagrams.existsById(diagramId)) {
            throw new NotFoundException("Diagram not found");
        }
        int rating = request.rating() == null ? 0 : request.rating();
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be 1-5");
        }
        Review review = reviews.findByDiagramIdAndUserEmail(diagramId, userEmail).orElseGet(Review::new);
        review.setDiagramId(diagramId);
        review.setUserEmail(userEmail);
        review.setUserName(displayName(userEmail));
        review.setRating(rating);
        review.setComment(trim(request.comment()));
        reviews.save(review);
        return aggregate(diagramId, userEmail);
    }

    @Override
    public List<ReviewSummaryDto> summary() {
        Map<Long, int[]> agg = new LinkedHashMap<>(); // diagramId -> [sum, count]
        for (Review r : reviews.findAll()) {
            int[] a = agg.computeIfAbsent(r.getDiagramId(), k -> new int[2]);
            a[0] += r.getRating();
            a[1] += 1;
        }
        List<ReviewSummaryDto> out = new ArrayList<>();
        agg.forEach((diagramId, a) -> out.add(new ReviewSummaryDto(diagramId, round1((double) a[0] / a[1]), a[1])));
        return out;
    }

    // ---- helpers ----

    private ReviewResponse aggregate(Long diagramId, String email) {
        List<Review> list = reviews.findByDiagramIdOrderByUpdatedAtDesc(diagramId);
        int sum = 0;
        Map<String, Integer> dist = new LinkedHashMap<>();
        for (int s = 5; s >= 1; s--) {
            dist.put(String.valueOf(s), 0);
        }
        List<ReviewItemDto> items = new ArrayList<>();
        ReviewResponse.Mine mine = null;
        for (Review r : list) {
            sum += r.getRating();
            dist.merge(String.valueOf(r.getRating()), 1, Integer::sum);
            boolean self = email != null && email.equals(r.getUserEmail());
            items.add(new ReviewItemDto(
                    r.getUserName() == null ? "Anonymous" : r.getUserName(),
                    r.getRating(),
                    r.getComment() == null ? "" : r.getComment(),
                    r.getUpdatedAt(),
                    self));
            if (self) {
                mine = new ReviewResponse.Mine(r.getRating(), r.getComment() == null ? "" : r.getComment());
            }
        }
        int count = list.size();
        double average = count == 0 ? 0.0 : round1((double) sum / count);
        return new ReviewResponse(average, count, dist, mine, items);
    }

    private String displayName(String email) {
        return users.findByEmail(email)
                .map(User::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElse(email);
    }

    private static String trim(String comment) {
        if (comment == null) {
            return "";
        }
        String t = comment.trim();
        return t.length() > MAX_COMMENT_LENGTH ? t.substring(0, MAX_COMMENT_LENGTH) : t;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
