package com.example.diagram.service.impl;

import com.example.diagram.domain.Review;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.ReviewRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.web.dto.ReviewRequest;
import com.example.diagram.web.dto.ReviewResponse;
import com.example.diagram.web.error.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

/** Unit tests for the review aggregation, validation and upsert logic. */
@ExtendWith(MockitoExtension.class)
class ReviewServiceImplTest {

    @Mock private ReviewRepository reviews;
    @Mock private DiagramRepository diagrams;
    @Mock private UserRepository users;
    @InjectMocks private ReviewServiceImpl service;

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
    void getForDiagram_computesAverageDistributionAndMarksOwnReview() {
        when(reviews.findByDiagramIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of(
                review(1L, "a@x.com", "Ann", 5, "great"),
                review(1L, "b@x.com", "Bob", 3, "ok")));

        ReviewResponse res = service.getForDiagram(1L, "a@x.com");

        assertThat(res.count()).isEqualTo(2);
        assertThat(res.average()).isEqualTo(4.0);
        assertThat(res.distribution().get("5")).isEqualTo(1);
        assertThat(res.distribution().get("3")).isEqualTo(1);
        assertThat(res.distribution().get("4")).isEqualTo(0);
        assertThat(res.mine()).isNotNull();
        assertThat(res.mine().rating()).isEqualTo(5);
    }

    @Test
    void getForDiagram_emptyHasZeroAverageAndNoMine() {
        when(reviews.findByDiagramIdOrderByUpdatedAtDesc(2L)).thenReturn(List.of());
        ReviewResponse res = service.getForDiagram(2L, "a@x.com");
        assertThat(res.count()).isZero();
        assertThat(res.average()).isEqualTo(0.0);
        assertThat(res.mine()).isNull();
    }

    @Test
    void submit_rejectsRatingOutOfRange() {
        when(diagrams.existsById(1L)).thenReturn(true);
        assertThrows(IllegalArgumentException.class,
                () -> service.submit(1L, new ReviewRequest(6, "x"), "a@x.com"));
        verify(reviews, never()).save(any());
    }

    @Test
    void submit_notFoundWhenDiagramMissing() {
        when(diagrams.existsById(9L)).thenReturn(false);
        assertThrows(NotFoundException.class,
                () -> service.submit(9L, new ReviewRequest(4, "x"), "a@x.com"));
    }

    @Test
    void submit_savesReviewFromSession() {
        when(diagrams.existsById(1L)).thenReturn(true);
        when(reviews.findByDiagramIdAndUserEmail(1L, "a@x.com")).thenReturn(Optional.empty());
        when(users.findByEmail("a@x.com")).thenReturn(Optional.empty());
        when(reviews.findByDiagramIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of());

        service.submit(1L, new ReviewRequest(4, "nice"), "a@x.com");

        ArgumentCaptor<Review> captor = ArgumentCaptor.forClass(Review.class);
        verify(reviews).save(captor.capture());
        Review saved = captor.getValue();
        assertThat(saved.getRating()).isEqualTo(4);
        assertThat(saved.getComment()).isEqualTo("nice");
        assertThat(saved.getUserEmail()).isEqualTo("a@x.com");
        assertThat(saved.getDiagramId()).isEqualTo(1L);
    }
}
