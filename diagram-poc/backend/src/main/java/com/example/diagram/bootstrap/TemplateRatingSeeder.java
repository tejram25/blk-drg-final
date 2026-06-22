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
 * Seeds a few demo reviews (rating + comment) on the bundled starter templates
 * so the gallery cards show ratings and the reviews modal has content out of the
 * box. Runs after {@link TemplateSeeder} and is idempotent: a user who already
 * reviewed a template is left untouched.
 */
@Component
@Order(4)
public class TemplateRatingSeeder implements CommandLineRunner {

    private record Demo(String email, String name, int rating, String comment) {}

    private static final Map<String, List<Demo>> DEMO = Map.of(
            "AMR Robot (FAST)", List.of(
                    new Demo("priya.demo@example.com", "Priya Nair", 5,
                            "Brilliant starting point — the FAST grouping saved me a whole afternoon."),
                    new Demo("marco.demo@example.com", "Marco Rossi", 5,
                            "Clean blocks, easy to extend for our drive system."),
                    new Demo("aisha.demo@example.com", "Aisha Khan", 4,
                            "Great base. Would love a few more sensor blocks pre-wired.")),
            "Smart Microgrid", List.of(
                    new Demo("liam.demo@example.com", "Liam O'Brien", 5,
                            "Exactly how we model inverter/battery flow. Reused immediately."),
                    new Demo("sofia.demo@example.com", "Sofia Almeida", 4,
                            "Readable and well laid out — a colour legend would top it off.")),
            "555 LED Blinker", List.of(
                    new Demo("ken.demo@example.com", "Ken Watanabe", 5,
                            "Perfect teaching example, the schematic symbols are crisp."),
                    new Demo("maria.demo@example.com", "Maria Gomez", 3,
                            "Good, but I had to tweak the timing resistor values for my build.")),
            "Parts & BOM starter", List.of(
                    new Demo("tom.demo@example.com", "Tom Becker", 5,
                            "Loved that the parts are already grouped — BOM export just worked."),
                    new Demo("lena.demo@example.com", "Lena Fischer", 4,
                            "Handy starter. Swapped a couple of parts and re-exported in minutes."))
    );

    private final TemplateRepository templates;
    private final TemplateRatingRepository ratings;

    public TemplateRatingSeeder(TemplateRepository templates, TemplateRatingRepository ratings) {
        this.templates = templates;
        this.ratings = ratings;
    }

    @Override
    public void run(String... args) {
        DEMO.forEach((name, reviews) -> templates.findByNameIgnoreCase(name)
                .ifPresent(t -> reviews.forEach(d -> seed(t.getId(), d))));
    }

    private void seed(Long templateId, Demo d) {
        if (ratings.findByTemplateIdAndUserEmail(templateId, d.email()).isPresent()) {
            return; // already seeded
        }
        TemplateRating r = new TemplateRating();
        r.setTemplateId(templateId);
        r.setUserEmail(d.email());
        r.setUserName(d.name());
        r.setRating(d.rating());
        r.setComment(d.comment());
        ratings.save(r);
    }
}
