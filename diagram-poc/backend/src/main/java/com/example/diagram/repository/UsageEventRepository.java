package com.example.diagram.repository;

import com.example.diagram.domain.UsageEvent;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UsageEventRepository extends JpaRepository<UsageEvent, Long> {

    List<UsageEvent> findTop100ByOrderByOccurredAtDesc();
}
