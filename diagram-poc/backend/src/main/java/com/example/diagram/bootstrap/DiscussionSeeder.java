package com.example.diagram.bootstrap;

import com.example.diagram.domain.FeedbackEntry;
import com.example.diagram.domain.FeedbackThread;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.FeedbackEntryRepository;
import com.example.diagram.repository.FeedbackThreadRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Seeds one demo discussion (feedback loop) on the 555 sample so the
 * Discussions panel shows the sales → engineering → customer flow out of the
 * box. Runs after {@link SampleDiagramSeeder}; idempotent — a diagram that
 * already has any discussion is left untouched, so restarts don't duplicate
 * and user activity is never overwritten.
 */
@Component
@Order(3)
public class DiscussionSeeder implements CommandLineRunner {

    private static final String DIAGRAM = "Sample - 555 LED Blinker";
    /** Node key of the 555 timer in the bundled sample (sample-555.json). */
    private static final String ANCHOR_NODE = "u1";

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
        diagrams.findAll().stream()
                .filter(d -> DIAGRAM.equals(d.getName()))
                .findFirst()
                .ifPresent(d -> seed(d.getId()));
    }

    private void seed(Long diagramId) {
        if (!threads.findByDiagramIdOrderByUpdatedAtDesc(diagramId).isEmpty()) return;

        FeedbackThread t = new FeedbackThread();
        t.setDiagramId(diagramId);
        t.setTitle("Blink rate feels too slow for the demo unit");
        t.setNodeId(ANCHOR_NODE);
        t.setStatus(FeedbackThread.CHANGES_REQUESTED);
        t.setCreatedByEmail("priya.demo@example.com");
        t.setCreatedByName("Priya Nair");
        t = threads.save(t);

        entry(t.getId(), "priya.demo@example.com", "Priya Nair", "Sales", FeedbackEntry.COMMENT,
                "Customer demoed the blinker and asked for a snappier blink — roughly twice as fast. "
                        + "Can we adjust the timing parts without a board respin?");
        entry(t.getId(), "ken.demo@example.com", "Ken Watanabe", "Customer", FeedbackEntry.COMMENT,
                "Confirming: ~1 Hz feels sluggish on the exhibition stand. Around 2 Hz would look livelier.");
        entry(t.getId(), "aisha.demo@example.com", "Aisha Khan", "Engineering", FeedbackEntry.REQUEST_CHANGES,
                "Doable in the astable network: halving C1 to 4.7 µF (or dropping R2 to ~22 kΩ) roughly doubles "
                        + "the frequency. Requesting changes on the diagram — update C1's value and re-run the BOM.");
    }

    private void entry(Long threadId, String email, String name, String role, String decision, String text) {
        FeedbackEntry e = new FeedbackEntry();
        e.setThreadId(threadId);
        e.setAuthorEmail(email);
        e.setAuthorName(name);
        e.setRole(role);
        e.setDecision(decision);
        e.setText(text);
        entries.save(e);
    }
}
