package com.example.diagram;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

/**
 * Unit tests for the review aggregation, validation and upsert logic. Pure
 * Mockito (no Spring context) so they run fast and don't need a database.
 */
@ExtendWith(MockitoExtension.class)
class ReviewControllerTest {

    @Mock private ReviewRepository reviews;
    @Mock private DiagramRepository diagrams;
    @Mock private UserRepository users;
    @InjectMocks private ReviewController controller;

    private static Authentication authOf(String email) {
        Authentication a = mock(Authentication.class);
        // lenient: some tests throw before reading the name (validation/not-found).
        lenient().when(a.getName()).thenReturn(email);
        return a;
    }

    private static Review review(long diagramId, String email, String name, int rating, String comment) {
        Review r = new Review();
        r.setDiagramId(diagramId);
        r.setUserEmail(email);
        r.setUserName(name);
        r.setRating(rating);
        r.setComment(comment);
        r.onCreate();
        return r;
    }

    @Test
    void forDiagram_computesAverageDistributionAndMarksOwnReview() {
        when(reviews.findByDiagramIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of(
                review(1L, "a@x.com", "Ann", 5, "great"),
                review(1L, "b@x.com", "Bob", 3, "ok")));

        Map<String, Object> res = controller.forDiagram(1L, authOf("a@x.com"));

        assertThat(res.get("count")).isEqualTo(2);
        assertThat(res.get("average")).isEqualTo(4.0);
        @SuppressWarnings("unchecked")
        Map<String, Integer> dist = (Map<String, Integer>) res.get("distribution");
        assertThat(dist.get("5")).isEqualTo(1);
        assertThat(dist.get("3")).isEqualTo(1);
        assertThat(dist.get("4")).isEqualTo(0);
        assertThat(res.get("mine")).isNotNull(); // caller a@x.com has a review
    }

    @Test
    void forDiagram_emptyHasZeroAverageAndNoMine() {
        when(reviews.findByDiagramIdOrderByUpdatedAtDesc(2L)).thenReturn(List.of());
        Map<String, Object> res = controller.forDiagram(2L, authOf("a@x.com"));
        assertThat(res.get("count")).isEqualTo(0);
        assertThat(res.get("average")).isEqualTo(0.0);
        assertThat(res.get("mine")).isNull();
    }

    @Test
    void submit_rejectsRatingOutOfRange() {
        when(diagrams.existsById(1L)).thenReturn(true);
        assertThrows(ResponseStatusException.class,
                () -> controller.submit(1L, new ReviewController.ReviewRequest(6, "x"), authOf("a@x.com")));
        verify(reviews, never()).save(any());
    }

    @Test
    void submit_notFoundWhenDiagramMissing() {
        when(diagrams.existsById(9L)).thenReturn(false);
        assertThrows(ResponseStatusException.class,
                () -> controller.submit(9L, new ReviewController.ReviewRequest(4, "x"), authOf("a@x.com")));
    }

    @Test
    void submit_savesReviewFromSession() {
        when(diagrams.existsById(1L)).thenReturn(true);
        when(reviews.findByDiagramIdAndUserEmail(1L, "a@x.com")).thenReturn(Optional.empty());
        when(users.findByEmail("a@x.com")).thenReturn(Optional.empty());
        when(reviews.findByDiagramIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of());

        controller.submit(1L, new ReviewController.ReviewRequest(4, "nice"), authOf("a@x.com"));

        ArgumentCaptor<Review> captor = ArgumentCaptor.forClass(Review.class);
        verify(reviews).save(captor.capture());
        Review saved = captor.getValue();
        assertThat(saved.getRating()).isEqualTo(4);
        assertThat(saved.getComment()).isEqualTo("nice");
        assertThat(saved.getUserEmail()).isEqualTo("a@x.com");
        assertThat(saved.getDiagramId()).isEqualTo(1L);
    }
}
