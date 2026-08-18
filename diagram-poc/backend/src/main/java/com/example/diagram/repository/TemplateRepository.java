package com.example.diagram.repository;

import com.example.diagram.domain.Template;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TemplateRepository extends JpaRepository<Template, Long> {

    /** Gallery order: most-used first, then most-recently improved. */
    List<Template> findAllByOrderByUsageCountDescUpdatedAtDesc();

    Optional<Template> findByNameIgnoreCase(String name);
}
