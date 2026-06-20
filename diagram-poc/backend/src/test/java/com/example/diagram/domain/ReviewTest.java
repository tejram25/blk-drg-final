package com.example.diagram.domain;

import com.example.diagram.domain.Review;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure unit test for the Review entity's JPA lifecycle callbacks. */
class ReviewTest {

    @Test
    void onCreate_stampsCreatedAndUpdated() {
        Review r = new Review();
        r.onCreate();
        assertThat(r.getCreatedAt()).isNotNull();
        assertThat(r.getUpdatedAt()).isNotNull();
        assertThat(r.getUpdatedAt()).isEqualTo(r.getCreatedAt());
    }

    @Test
    void onUpdate_movesUpdatedAtForward() throws InterruptedException {
        Review r = new Review();
        r.onCreate();
        var created = r.getCreatedAt();
        Thread.sleep(5);
        r.onUpdate();
        assertThat(r.getUpdatedAt()).isAfterOrEqualTo(created);
    }
}
