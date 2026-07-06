package com.example.diagram.bootstrap;

import com.example.diagram.domain.FeedbackEntry;
import com.example.diagram.domain.FeedbackThread;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.FeedbackEntryRepository;
import com.example.diagram.repository.FeedbackThreadRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Seeds one demo discussion (feedback loop) on each bundled sample so the
 * Discussions panel shows the sales → engineering → customer flow out of the
 * box. Runs after {@link SampleDiagramSeeder}; idempotent — a diagram that
 * already has any discussion is left untouched, so restarts don't duplicate
 * and user activity is never overwritten.
 */
@Component
@Order(3)
public class DiscussionSeeder implements CommandLineRunner {

    private record Msg(String email, String name, String role, String decision, String text) {}

    private record Demo(String diagram, String title, String anchorNode, String status,
                        String byEmail, String byName, List<Msg> entries) {}

    private static final List<Demo> DEMOS = List.of(
            new Demo("Sample - 555 LED Blinker",
                    "Blink rate feels too slow for the demo unit",
                    "u1", // node key of the 555 timer in sample-555.json
                    FeedbackThread.CHANGES_REQUESTED,
                    "priya.demo@example.com", "Priya Nair",
                    List.of(
                            new Msg("priya.demo@example.com", "Priya Nair", "Sales", FeedbackEntry.COMMENT,
                                    "Customer demoed the blinker and asked for a snappier blink — roughly twice as fast. "
                                            + "Can we adjust the timing parts without a board respin?"),
                            new Msg("ken.demo@example.com", "Ken Watanabe", "Customer", FeedbackEntry.COMMENT,
                                    "Confirming: ~1 Hz feels sluggish on the exhibition stand. Around 2 Hz would look livelier."),
                            new Msg("aisha.demo@example.com", "Aisha Khan", "Engineering", FeedbackEntry.REQUEST_CHANGES,
                                    "Doable in the astable network: halving C1 to 4.7 µF (or dropping R2 to ~22 kΩ) roughly doubles "
                                            + "the frequency. Requesting changes on the diagram — update C1's value and re-run the BOM."))),
            new Demo("Sample - Smart Microgrid",
                    "Battery bank sizing for the evening peak",
                    "n-battery", // battery node in sample-diagram.json
                    FeedbackThread.OPEN,
                    "ken.demo@example.com", "Ken Watanabe",
                    List.of(
                            new Msg("ken.demo@example.com", "Ken Watanabe", "Customer", FeedbackEntry.COMMENT,
                                    "Our evening peak runs about 40 kW for two hours after the solar array drops off. "
                                            + "Is the battery block here sized for that, or do we need a second string?"),
                            new Msg("aisha.demo@example.com", "Aisha Khan", "Engineering", FeedbackEntry.COMMENT,
                                    "The current block assumes 60 kWh usable. 40 kW × 2 h = 80 kWh, so we'd either add a "
                                            + "second string or shave the peak with the grid tie. I'll model both options this week."))),
            new Demo("Sample - AMR Robot (FAST)",
                    "LiDAR mounting on the chassis",
                    "chassis", // chassis node in sample-amr.json
                    FeedbackThread.APPROVED,
                    "priya.demo@example.com", "Priya Nair",
                    List.of(
                            new Msg("priya.demo@example.com", "Priya Nair", "Sales", FeedbackEntry.COMMENT,
                                    "Customer wants a 360° LiDAR on the chassis top plate — can the current frame take the "
                                            + "extra mount without changing the drive layout?"),
                            new Msg("aisha.demo@example.com", "Aisha Khan", "Engineering", FeedbackEntry.APPROVE,
                                    "Yes — the top plate has spare bosses and the harness has two free connectors. "
                                            + "Approving; no changes needed to the block diagram."))));

    private final DiagramRepository diagrams;
    private final FeedbackThreadRepository threads;
    private final FeedbackEntryRepository entries;

    public DiscussionSeeder(DiagramRepository diagrams, FeedbackThreadRepository threads,
                            FeedbackEntryRepository entries) {
        this.diagrams = diagrams;
        this.threads = threads;
        this.entries = entries;
    }

    @Override
    public void run(String... args) {
        for (Demo demo : DEMOS) {
            diagrams.findAll().stream()
                    .filter(d -> demo.diagram().equals(d.getName()))
                    .findFirst()
                    .ifPresent(d -> seed(d.getId(), demo));
        }
    }

    private void seed(Long diagramId, Demo demo) {
        if (!threads.findByDiagramIdOrderByUpdatedAtDesc(diagramId).isEmpty()) return;

        FeedbackThread t = new FeedbackThread();
        t.setDiagramId(diagramId);
        t.setTitle(demo.title());
        t.setNodeId(demo.anchorNode());
        t.setStatus(demo.status());
        t.setCreatedByEmail(demo.byEmail());
        t.setCreatedByName(demo.byName());
        t = threads.save(t);

        for (Msg m : demo.entries()) {
            FeedbackEntry e = new FeedbackEntry();
            e.setThreadId(t.getId());
            e.setAuthorEmail(m.email());
            e.setAuthorName(m.name());
            e.setRole(m.role());
            e.setDecision(m.decision());
            e.setText(m.text());
            entries.save(e);
        }
    }
}
