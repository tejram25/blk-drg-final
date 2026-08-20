package com.example.diagram.bootstrap;

import com.example.diagram.domain.Diagram;
import com.example.diagram.repository.DiagramRepository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Seeds one connected, multi-level diagram — "Multi Level Diagram — System" and
 * the boards and dies it drills into. Every level is an ordinary saved diagram,
 * and a parent block is linked to its child by that child's real id.
 *
 * <p>The ids only exist once a row is saved, so the levels are created
 * deepest-first: each level file marks a drillable block with a {@code childRef}
 * (a stable name like "compute"), and this seeder swaps that for the concrete
 * {@code childDiagramId} once the referenced level has been created. Create-only,
 * matched by name, so ids — and any later edits — survive a restart.
 */
@Component
@Order(2)
public class MultiLevelDiagramSeeder implements CommandLineRunner {

    private static final Pattern CHILD_REF =
            Pattern.compile("\"childRef\"\\s*:\\s*\"(\\w+)\"");

    private final DiagramRepository repository;
    private final ObjectMapper mapper = new ObjectMapper();

    public MultiLevelDiagramSeeder(DiagramRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) throws Exception {
        JsonNode manifest;
        try (InputStream in = getClass().getResourceAsStream("/multilevel/manifest.json")) {
            if (in == null) return;
            manifest = mapper.readTree(in);
        }
        // ref name -> saved diagram id, filled as we go (children before parents).
        Map<String, Long> refToId = new HashMap<>();

        for (JsonNode entry : manifest) {
            String name = entry.path("name").asText();
            String resource = entry.path("resource").asText();
            String ref = entry.hasNonNull("ref") ? entry.get("ref").asText() : null;

            Diagram existing = repository.findAll().stream()
                    .filter(d -> name.equals(d.getName()))
                    .findFirst().orElse(null);
            if (existing != null) {
                if (ref != null && existing.getId() != null) refToId.put(ref, existing.getId());
                continue; // create-only: keep stable ids and any user edits
            }

            String json = read(resource);
            if (json == null) continue;
            Diagram d = new Diagram();
            d.setName(name);
            d.setContentJson(resolveChildRefs(json, refToId));
            d.setClassification("INTERNAL");
            Diagram saved = repository.save(d);
            if (ref != null) refToId.put(ref, saved.getId());
        }
    }

    private String read(String resource) throws Exception {
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            if (in == null) return null;
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    /**
     * Turn every {@code "childRef":"name"} into {@code "childDiagramId": <id>}
     * for a level that has already been created; a ref with no id yet is dropped
     * so it never ships a dangling link.
     */
    private String resolveChildRefs(String json, Map<String, Long> refToId) {
        Matcher m = CHILD_REF.matcher(json);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            Long id = refToId.get(m.group(1));
            String replacement = id != null
                    ? "\"childDiagramId\": " + id
                    : "\"_unlinked\": true";
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);
        return out.toString();
    }
}
