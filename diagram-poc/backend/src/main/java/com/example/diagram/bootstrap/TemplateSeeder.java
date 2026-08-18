package com.example.diagram.bootstrap;

import com.example.diagram.domain.Template;
import com.example.diagram.repository.TemplateRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Seeds the shared template repository with a few ready-made starters so the
 * gallery isn't empty on first run. Unlike the diagram sample seeder this is
 * <em>create-only</em>: a template that already exists (matched by name) is left
 * untouched, so user improvements to seeded templates survive restarts.
 */
@Component
@Order(3)
public class TemplateSeeder implements CommandLineRunner {

    private record Starter(String name, String description, String category, String resource) {}

    private static final List<Starter> STARTERS = List.of(
            new Starter("AMR Robot (FAST)",
                    "Autonomous mobile robot architecture grouped the FAST way — a strong starting point for robotics block diagrams.",
                    "Robotics", "/sample-amr.json"),
            new Starter("Smart Microgrid",
                    "Energy-flow reference with inverter, battery and grid blocks. Great base for power-system diagrams.",
                    "Power", "/sample-diagram.json"),
            new Starter("555 LED Blinker",
                    "Classic 555 astable circuit using schematic symbols — a tidy teaching example to build on.",
                    "Learning", "/sample-555.json"),
            new Starter("Parts & BOM starter",
                    "Catalogue part cards arranged inside labelled groups. Use it, add or swap parts, then export a Bill of Materials.",
                    "Electronics", "/template-bom-demo.json")
    );

    private final TemplateRepository templates;

    public TemplateSeeder(TemplateRepository templates) {
        this.templates = templates;
    }

    @Override
    public void run(String... args) throws Exception {
        for (Starter starter : STARTERS) {
            seed(starter);
        }
    }

    private void seed(Starter starter) throws Exception {
        if (templates.findByNameIgnoreCase(starter.name()).isPresent()) {
            return; // already seeded — keep any community improvements
        }
        try (InputStream in = getClass().getResourceAsStream(starter.resource())) {
            if (in == null) return;
            String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            Template template = new Template();
            template.setName(starter.name());
            template.setDescription(starter.description());
            template.setCategory(starter.category());
            template.setContentJson(json);
            template.setAuthorName("Template Library");
            templates.save(template);
        }
    }
}
