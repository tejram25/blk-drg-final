package com.example.diagram.bootstrap;

import com.example.diagram.domain.TemplateRating;
import com.example.diagram.repository.TemplateRatingRepository;
import com.example.diagram.repository.TemplateRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Seeds a few demo star ratings on the bundled starter templates so the gallery
 * cards show ratings out of the box. Runs after {@link TemplateSeeder} and is
 * idempotent: a user who already rated a template is left untouched.
 */
@Component
@Order(4)
public class TemplateRatingSeeder implements CommandLineRunner {

    private static final Map<String, List<Integer>> DEMO = Map.of(
            "AMR Robot (FAST)", List.of(5, 5, 4, 5),
            "Smart Microgrid", List.of(4, 5, 4),
            "555 LED Blinker", List.of(4, 3, 5),
            "Parts & BOM starter", List.of(5, 4)
    );

    private final TemplateRepository templates;
    private final TemplateRatingRepository ratings;

    public TemplateRatingSeeder(TemplateRepository templates, TemplateRatingRepository ratings) {
        this.templates = templates;
        this.ratings = ratings;
    }

    @Override
    public void run(String... args) {
        DEMO.forEach((name, stars) -> templates.findByNameIgnoreCase(name).ifPresent(t -> {
            for (int i = 0; i < stars.size(); i++) {
                seed(t.getId(), "rater" + (i + 1) + ".demo@example.com", stars.get(i));
            }
        }));
    }

    private void seed(Long templateId, String email, int stars) {
        if (ratings.findByTemplateIdAndUserEmail(templateId, email).isPresent()) {
            return; // already seeded
        }
        TemplateRating r = new TemplateRating();
        r.setTemplateId(templateId);
        r.setUserEmail(email);
        r.setRating(stars);
        ratings.save(r);
    }
}
