package com.example.diagram.repository;

import com.example.diagram.domain.FeedbackEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeedbackEntryRepository extends JpaRepository<FeedbackEntry, Long> {
    List<FeedbackEntry> findByThreadIdOrderByCreatedAtAscIdAsc(Long threadId);
    List<FeedbackEntry> findByThreadIdInOrderByCreatedAtAscIdAsc(List<Long> threadIds);
}
