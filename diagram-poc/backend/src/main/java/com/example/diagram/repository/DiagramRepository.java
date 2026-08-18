package com.example.diagram.repository;

import com.example.diagram.domain.Diagram;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DiagramRepository extends JpaRepository<Diagram, Long> {
}
