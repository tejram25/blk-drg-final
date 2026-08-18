package com.example.diagram.web.dto;

import java.time.Instant;
import java.util.List;

/** DTOs for the diagram feedback loop (threaded reviews with free-form roles). */
public final class FeedbackLoopDtos {

    private FeedbackLoopDtos() {
    }

    /** One turn of a loop. {@code mine} marks entries by the requesting user. */
    public record EntryDto(Long id, String authorName, String role, String decision,
                           String text, Instant createdAt, boolean mine) {
    }

    /** A loop with its full timeline. */
    public record ThreadDto(Long id, String title, String nodeId, String status,
                            String createdByName, Instant createdAt, Instant updatedAt,
                            List<EntryDto> entries) {
    }

    /** Threads plus the role tags already used on this diagram (for suggestions). */
    public record BoardDto(List<ThreadDto> threads, List<String> roles) {
    }

    /** New loop: first entry is created alongside it. */
    public record NewThreadRequest(String title, String nodeId, String role, String text) {
    }

    /** Reply / decision on an existing loop. */
    public record NewEntryRequest(String role, String decision, String text) {
    }
}
