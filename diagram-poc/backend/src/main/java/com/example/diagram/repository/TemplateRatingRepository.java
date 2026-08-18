package com.example.diagram.repository;

import com.example.diagram.domain.TemplateRating;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TemplateRatingRepository extends JpaRepository<TemplateRating, Long> {

    List<TemplateRating> findByTemplateId(Long templateId);

    Optional<TemplateRating> findByTemplateIdAndUserEmail(Long templateId, String userEmail);
}
