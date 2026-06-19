package com.example.diagram;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Seeds a handful of demo reviews on the bundled sample diagrams so the
 * reviews UI has content out of the box. Runs after {@link SampleDiagramSeeder}
 * (see @Order) and is idempotent: a reviewer who already reviewed a diagram is
 * left untouched, so restarts don't create duplicates.
 */
@Component
@Order(2)
public class ReviewSeeder implements CommandLineRunner {

    private record Demo(String email, String name, int rating, String comment) {}

    private static final Map<String, List<Demo>> DEMO = Map.of(
            "Sample - AMR Robot (FAST)", List.of(
                    new Demo("priya.demo@example.com", "Priya Nair", 5,
                            "Fantastic starting point for our AMR project — the FAST grouping made the architecture review a breeze."),
                    new Demo("marco.demo@example.com", "Marco Rossi", 4,
                            "Really solid structure. Would have loved a bit more detail on the power-management bus, but easy to extend."),
                    new Demo("aisha.demo@example.com", "Aisha Khan", 5,
                            "Clear, well-labelled blocks. Saved me a couple of hours of layout work.")),
            "Sample - Smart Microgrid", List.of(
                    new Demo("liam.demo@example.com", "Liam O'Brien", 5,
                            "Great reference for energy flow. The inverter/battery split is exactly how we model ours."),
                    new Demo("sofia.demo@example.com", "Sofia Almeida", 4,
                            "Clean and readable. A legend for the line colours would make it perfect.")),
            "Sample - 555 LED Blinker", List.of(
                    new Demo("ken.demo@example.com", "Ken Watanabe", 4,
                            "Nice little teaching example — schematic symbols are crisp."),
                    new Demo("maria.demo@example.com", "Maria Gomez", 5,
                            "Used this in a workshop. Beginners got it instantly."))
    );

    private final DiagramRepository diagrams;
    private final ReviewRepository reviews;

    public ReviewSeeder(DiagramRepository diagrams, ReviewRepository reviews) {
        this.diagrams = diagrams;
        this.reviews = reviews;
    }

    @Override
    public void run(String... args) {
        DEMO.forEach((diagramName, demoReviews) -> {
            diagrams.findAll().stream()
                    .filter(d -> diagramName.equals(d.getName()))
                    .findFirst()
                    .ifPresent(diagram -> demoReviews.forEach(demo -> seed(diagram.getId(), demo)));
        });
    }

    private void seed(Long diagramId, Demo demo) {
        if (reviews.findByDiagramIdAndUserEmail(diagramId, demo.email()).isPresent()) {
            return; // already seeded — leave any edits alone
        }
        Review review = new Review();
        review.setDiagramId(diagramId);
        review.setUserEmail(demo.email());
        review.setUserName(demo.name());
        review.setRating(demo.rating());
        review.setComment(demo.comment());
        reviews.save(review);
    }
}
