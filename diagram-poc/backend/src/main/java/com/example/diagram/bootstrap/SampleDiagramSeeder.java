package com.example.diagram.bootstrap;

import com.example.diagram.domain.Diagram;
import com.example.diagram.repository.DiagramRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Inserts ready-made example diagrams on startup so users can open them
 * straight from the "Open saved…" dropdown. Existing samples are UPDATED
 * in place, so editing the bundled JSON + restarting refreshes them.
 */
@Component
@Order(1)
public class SampleDiagramSeeder implements CommandLineRunner {

    private static final Map<String, String> SAMPLES = Map.of(
            "Sample - Smart Microgrid", "/sample-diagram.json",
            "Sample - 555 LED Blinker", "/sample-555.json",
            "Sample - AMR Robot (FAST)", "/sample-amr.json"
    );

    private final DiagramRepository repository;

    public SampleDiagramSeeder(DiagramRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) throws Exception {
        for (Map.Entry<String, String> entry : SAMPLES.entrySet()) {
            seed(entry.getKey(), entry.getValue());
        }
    }

    private void seed(String name, String resource) throws Exception {
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            if (in == null) return;
            String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            Diagram sample = repository.findAll().stream()
                    .filter(d -> name.equals(d.getName()))
                    .findFirst()
                    .orElseGet(Diagram::new);
            sample.setName(name);
            sample.setContentJson(json);
            repository.save(sample);
        }
    }
}
