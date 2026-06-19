package com.example.diagram;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reviews (star rating + comment) for saved diagrams. One review per user per
 * diagram; posting again updates it. All endpoints require an authenticated
 * session (see SecurityConfig); the reviewer is taken from the session, never
 * the request body.
 */
@RestController
@RequestMapping("/api")
public class ReviewController {

    private final ReviewRepository reviews;
    private final DiagramRepository diagrams;
    private final UserRepository users;

    public ReviewController(ReviewRepository reviews, DiagramRepository diagrams, UserRepository users) {
        this.reviews = reviews;
        this.diagrams = diagrams;
        this.users = users;
    }

    public record ReviewRequest(Integer rating, String comment) {}

    /** Full review data for one diagram: aggregate + the caller's own review + the list. */
    @GetMapping("/diagrams/{id}/reviews")
    public Map<String, Object> forDiagram(@PathVariable Long id, Authentication auth) {
        return summaryFor(id, auth == null ? null : auth.getName());
    }

    /** Create or update the caller's review for a diagram. */
    @PostMapping("/diagrams/{id}/reviews")
    public Map<String, Object> submit(@PathVariable Long id,
                                      @RequestBody ReviewRequest body,
                                      Authentication auth) {
        if (!diagrams.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Diagram not found");
        }
        int rating = body.rating() == null ? 0 : body.rating();
        if (rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be 1-5");
        }
        String email = auth.getName();
        Review review = reviews.findByDiagramIdAndUserEmail(id, email).orElseGet(Review::new);
        review.setDiagramId(id);
        review.setUserEmail(email);
        review.setUserName(displayName(email));
        review.setRating(rating);
        String comment = body.comment() == null ? "" : body.comment().trim();
        review.setComment(comment.length() > 2000 ? comment.substring(0, 2000) : comment);
        reviews.save(review);
        return summaryFor(id, email);
    }

    /** Lightweight aggregate (average + count) for every diagram, for the Open list badges. */
    @GetMapping("/reviews/summary")
    public List<Map<String, Object>> summary() {
        Map<Long, int[]> agg = new LinkedHashMap<>(); // diagramId -> [sum, count]
        for (Review r : reviews.findAll()) {
            int[] a = agg.computeIfAbsent(r.getDiagramId(), k -> new int[2]);
            a[0] += r.getRating();
            a[1] += 1;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        agg.forEach((diagramId, a) -> out.add(Map.of(
                "diagramId", diagramId,
                "average", round1((double) a[0] / a[1]),
                "count", a[1])));
        return out;
    }

    // ---- helpers ----

    private Map<String, Object> summaryFor(Long diagramId, String email) {
        List<Review> list = reviews.findByDiagramIdOrderByUpdatedAtDesc(diagramId);
        int sum = 0;
        Map<String, Integer> dist = new LinkedHashMap<>();
        for (int s = 5; s >= 1; s--) dist.put(String.valueOf(s), 0);
        List<Map<String, Object>> items = new ArrayList<>();
        Map<String, Object> mine = null;
        for (Review r : list) {
            sum += r.getRating();
            dist.merge(String.valueOf(r.getRating()), 1, Integer::sum);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userName", r.getUserName() == null ? "Anonymous" : r.getUserName());
            item.put("rating", r.getRating());
            item.put("comment", r.getComment() == null ? "" : r.getComment());
            item.put("updatedAt", r.getUpdatedAt());
            item.put("self", email != null && email.equals(r.getUserEmail()));
            items.add(item);
            if (email != null && email.equals(r.getUserEmail())) {
                mine = Map.of("rating", r.getRating(), "comment", r.getComment() == null ? "" : r.getComment());
            }
        }
        int count = list.size();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("average", count == 0 ? 0.0 : round1((double) sum / count));
        result.put("count", count);
        result.put("distribution", dist);
        result.put("mine", mine);
        result.put("reviews", items);
        return result;
    }

    private String displayName(String email) {
        return users.findByEmail(email).map(User::getName).filter(n -> n != null && !n.isBlank())
                .orElse(email);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
