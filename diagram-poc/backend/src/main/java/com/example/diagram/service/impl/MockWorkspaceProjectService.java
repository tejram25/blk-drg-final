package com.example.diagram.service.impl;

import com.example.diagram.service.WorkspaceProjectService;
import com.example.diagram.web.dto.ArtifactDetail;
import com.example.diagram.web.dto.ArtifactSummary;
import com.example.diagram.web.dto.DatasetPreview;
import com.example.diagram.web.dto.NewArtifactRequest;
import com.example.diagram.web.dto.Page;
import com.example.diagram.web.dto.SyncRun;
import com.example.diagram.web.dto.SyncStatus;
import com.example.diagram.web.dto.UpdateArtifactRequest;
import com.example.diagram.web.dto.WorkspaceProjectDetail;
import com.example.diagram.web.dto.WorkspaceProjectSummary;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Mock workspace backend. Serves a small set of Salesforce-style projects with
 * canned engineering artefacts so the IDE runs without live credentials or
 * storage. The mirror <em>reports</em> a full catalogue of {@value #CATALOGUE}
 * projects (as the nightly job would) but only materialises the seed projects in
 * memory. Swap for a real implementation (same interface) when Salesforce and
 * artefact storage are available.
 *
 * <p>Artefacts are held mutable per project so create/update/delete work in the
 * demo; provenance is enforced (salesforce-origin artefacts reject writes).
 */
@Service
public class MockWorkspaceProjectService implements WorkspaceProjectService {

    /** Catalogue size the nightly mirror reports, independent of what's materialised. */
    private static final int CATALOGUE = 3184;

    private final Map<String, Project> projects = new LinkedHashMap<>();
    private final List<SyncRun> history = new ArrayList<>();
    private volatile SyncStatus sync;

    public MockWorkspaceProjectService() {
        seed();
        Instant now = Instant.now();
        this.sync = new SyncStatus(
                now.minus(Duration.ofHours(6)), now.plus(Duration.ofHours(18)),
                CATALOGUE - 2, 2, CATALOGUE, false);
        this.history.add(new SyncRun(
                "run-0001", "nightly", null, "partial",
                now.minus(Duration.ofHours(6)).minus(Duration.ofMinutes(4)),
                now.minus(Duration.ofHours(6)), CATALOGUE - 2, 2));
    }

    // ---- projects ----------------------------------------------------------

    @Override
    public Page<WorkspaceProjectSummary> searchProjects(
            String q, String stage, String health, String owner, int page, int size) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<WorkspaceProjectSummary> matches = projects.values().stream()
                .filter(p -> needle.isEmpty() || p.haystack().contains(needle))
                .filter(p -> blank(stage) || p.stage.equalsIgnoreCase(stage))
                .filter(p -> blank(health) || p.health.equalsIgnoreCase(health))
                .filter(p -> blank(owner) || p.owner.equalsIgnoreCase(owner))
                .sorted(Comparator.comparing((Project p) -> p.updatedAt).reversed())
                .map(Project::toSummary)
                .toList();
        int from = Math.min(page * size, matches.size());
        int to = Math.min(from + size, matches.size());
        return Page.of(matches.subList(from, to), page, size, matches.size());
    }

    @Override
    public WorkspaceProjectDetail getProject(String projectId) {
        return require(projectId).toDetail();
    }

    // ---- artefacts ---------------------------------------------------------

    @Override
    public List<ArtifactSummary> listArtifacts(String projectId) {
        return require(projectId).artifacts.stream().map(Artifact::toSummary).toList();
    }

    @Override
    public ArtifactDetail getArtifact(String projectId, String artifactId) {
        return requireArtifact(projectId, artifactId).toDetail();
    }

    @Override
    public byte[] getArtifactContent(String projectId, String artifactId) {
        byte[] body = requireArtifact(projectId, artifactId).content;
        return body == null ? new byte[0] : body;
    }

    @Override
    public ArtifactSummary createArtifact(
            String projectId, NewArtifactRequest request, byte[] content, String authorEmail) {
        Project project = require(projectId);
        if (blank(request.name()) || blank(request.kind())) {
            throw new IllegalArgumentException("name and kind are required");
        }
        String folder = blank(request.folder()) ? folderForKind(request.kind()) : request.folder();
        Artifact a = new Artifact(
                "art-" + UUID.randomUUID().toString().substring(0, 8),
                request.name(), request.kind(), folder, Instant.now(),
                authorEmail == null ? "anonymous" : authorEmail,
                content == null ? null : (long) content.length,
                null, "workspace", null, null, content);
        project.artifacts.add(a);
        project.updatedAt = Instant.now();
        return a.toSummary();
    }

    @Override
    public ArtifactSummary updateArtifact(
            String projectId, String artifactId, UpdateArtifactRequest request) {
        Artifact a = requireArtifact(projectId, artifactId);
        assertWritable(a);
        if (!blank(request.name())) a.name = request.name();
        if (!blank(request.folder())) a.folder = request.folder();
        a.updatedAt = Instant.now();
        return a.toSummary();
    }

    @Override
    public void deleteArtifact(String projectId, String artifactId) {
        Project project = require(projectId);
        Artifact a = requireArtifact(projectId, artifactId);
        assertWritable(a);
        project.artifacts.remove(a);
    }

    // ---- sync --------------------------------------------------------------

    @Override
    public SyncStatus syncStatus() {
        return sync;
    }

    @Override
    public synchronized SyncRun runSync(String triggeredByEmail) {
        if (sync.running()) {
            // Return the in-flight run rather than starting a second.
            return history.get(history.size() - 1);
        }
        Instant now = Instant.now();
        SyncRun run = new SyncRun(
                "run-" + UUID.randomUUID().toString().substring(0, 8),
                "manual", triggeredByEmail, "success", now, now, 6, 0);
        history.add(run);
        this.sync = new SyncStatus(now, sync.nextSync(), CATALOGUE + 6, 0, CATALOGUE + 6, false);
        return run;
    }

    @Override
    public Page<SyncRun> syncHistory(int page, int size) {
        List<SyncRun> newestFirst = history.stream()
                .sorted(Comparator.comparing(SyncRun::startedAt).reversed())
                .toList();
        int from = Math.min(page * size, newestFirst.size());
        int to = Math.min(from + size, newestFirst.size());
        return Page.of(newestFirst.subList(from, to), page, size, newestFirst.size());
    }

    // ---- helpers -----------------------------------------------------------

    private Project require(String projectId) {
        Project p = projects.get(projectId);
        if (p == null) throw new NotFoundException("Project not found: " + projectId);
        return p;
    }

    private Artifact requireArtifact(String projectId, String artifactId) {
        return require(projectId).artifacts.stream()
                .filter(a -> a.id.equals(artifactId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Artefact not found: " + artifactId));
    }

    private void assertWritable(Artifact a) {
        if ("salesforce".equals(a.origin)) {
            throw new AccessDeniedException(
                    "Artefact " + a.id + " is a read-only Salesforce mirror and cannot be modified here");
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String folderForKind(String kind) {
        return switch (kind) {
            case "diagram" -> "Diagrams";
            case "dataset" -> "Datasets";
            case "bom" -> "Bill of materials";
            case "review" -> "Reviews";
            default -> "Documents";
        };
    }

    // ---- seed --------------------------------------------------------------

    private void seed() {
        Instant now = Instant.now();
        AtomicInteger ig = new AtomicInteger();

        Project p1 = new Project("PRJ-4821", "006Ah000012Xk9Z", "BMS Controller Design",
                "Northwind Automotive", "Automotive", "Design", 1_240_000L, "Priya Raman",
                "ok", now.minus(Duration.ofHours(2)), 4, 62);
        p1.artifacts.addAll(List.of(
                diagram(ig, "Power Architecture — Rev C", 1L, "Priya Raman", hoursAgo(now, 2)),
                diagram(ig, "BMS Sense Chain", 2L, "Marco Silva", hoursAgo(now, 24)),
                document(ig, "Requirements Spec v2.pdf", 480_000L, "salesforce",
                        "Customer requirements baseline. Owned in Salesforce; synced read-only."),
                document(ig, "Thermal design note.md", 18_000L, "workspace",
                        "Derating assumptions for the 48V rail."),
                dataset(ig, "Thermal sweep 2026-07.csv", 214_000L,
                        List.of("Ambient °C", "Rail V", "Load A", "Case °C"),
                        List.of(List.of(25, 3.3, 0.5, 41), List.of(45, 3.3, 2.0, 92))),
                bom(ig, hoursAgo(now, 2)),
                review(ig, "Design review — Rev B", "Aisha Khan", hoursAgo(now, 5),
                        "Two findings: missing decoupling on U1, feedback divider unconnected.")));

        Project p2 = new Project("PRJ-4788", "006Ah000012Xj4M", "IoT Gateway Module",
                "Helio Systems", "Industrial IoT", "Prototype", 680_000L, "Marco Silva",
                "warn", now.minus(Duration.ofHours(5)), 3, 41);
        p2.artifacts.addAll(List.of(
                diagram(ig, "Gateway Architecture", 3L, "Marco Silva", hoursAgo(now, 5)),
                document(ig, "Certification plan.pdf", 320_000L, "salesforce", "CE and FCC test plan."),
                bom(ig, hoursAgo(now, 5))));

        Project p3 = new Project("PRJ-4763", "006Ah000012Xh8Q", "Power Supply Unit",
                "Vantage Medical", "Medical", "Production", 2_100_000L, "Aisha Khan",
                "risk", now.minus(Duration.ofDays(1)), 6, 118);
        p3.artifacts.addAll(List.of(
                diagram(ig, "PSU Main", null, "Aisha Khan", hoursAgo(now, 24)),
                document(ig, "IEC 60601 compliance.pdf", 760_000L, "salesforce",
                        "Medical safety compliance dossier."),
                bom(ig, hoursAgo(now, 24)),
                review(ig, "Lifecycle audit", "Inspection loop", hoursAgo(now, 3),
                        "LM2596S-5.0 is NRND and present in a released BOM.")));

        Project p4 = new Project("PRJ-4655", "006Ah000012Xd2B", "Motor Drive Inverter",
                "Kestrel Energy", "Energy", "Won", 3_450_000L, "Marco Silva",
                "ok", now.minus(Duration.ofDays(7)), 8, 203);
        p4.artifacts.addAll(List.of(
                diagram(ig, "Inverter Power Stage", null, "Marco Silva", daysAgo(now, 7)),
                document(ig, "Acceptance test report.pdf", 540_000L, "salesforce",
                        "Signed-off acceptance results."),
                bom(ig, daysAgo(now, 7))));

        for (Project p : List.of(p1, p2, p3, p4)) projects.put(p.id, p);
    }

    private static Instant hoursAgo(Instant now, int h) { return now.minus(Duration.ofHours(h)); }
    private static Instant daysAgo(Instant now, int d) { return now.minus(Duration.ofDays(d)); }

    private static Artifact diagram(AtomicInteger ig, String name, Long diagramId, String author, Instant updated) {
        return new Artifact("art-" + ig.incrementAndGet(), name, "diagram", "Diagrams",
                updated, author, null, diagramId, "workspace", null, null, null);
    }

    private static Artifact document(AtomicInteger ig, String name, Long size, String origin, String summary) {
        byte[] body = summary.getBytes(StandardCharsets.UTF_8);
        String author = "salesforce".equals(origin) ? "Salesforce" : "Priya Raman";
        return new Artifact("art-" + ig.incrementAndGet(), name, "document", "Documents",
                Instant.now().minus(Duration.ofDays(2)), author, size, null, origin, null, summary, body);
    }

    private static Artifact dataset(AtomicInteger ig, String name, Long size,
                                    List<String> columns, List<List<Object>> rows) {
        return new Artifact("art-" + ig.incrementAndGet(), name, "dataset", "Datasets",
                Instant.now().minus(Duration.ofDays(3)), "Test bench", size, null, "workspace",
                new DatasetPreview(columns, rows), null, null);
    }

    private static Artifact bom(AtomicInteger ig, Instant updated) {
        return new Artifact("art-" + ig.incrementAndGet(), "Bill of materials", "bom", "Bill of materials",
                updated, "Generated", null, null, "workspace", null, null, null);
    }

    private static Artifact review(AtomicInteger ig, String name, String author, Instant updated, String summary) {
        return new Artifact("art-" + ig.incrementAndGet(), name, "review", "Reviews",
                updated, author, null, null, "workspace", null, summary,
                summary.getBytes(StandardCharsets.UTF_8));
    }

    // ---- mutable domain (mock only) ----------------------------------------

    private static final class Project {
        final String id, sfdcId, name, customer, category, owner;
        String stage, health;
        long value;
        Instant updatedAt;
        int diagrams, parts;
        final List<Artifact> artifacts = new ArrayList<>();

        Project(String id, String sfdcId, String name, String customer, String category,
                String stage, long value, String owner, String health, Instant updatedAt,
                int diagrams, int parts) {
            this.id = id; this.sfdcId = sfdcId; this.name = name; this.customer = customer;
            this.category = category; this.stage = stage; this.value = value; this.owner = owner;
            this.health = health; this.updatedAt = updatedAt; this.diagrams = diagrams; this.parts = parts;
        }

        String haystack() {
            return (name + " " + customer + " " + id + " " + sfdcId + " " + owner).toLowerCase();
        }

        WorkspaceProjectSummary toSummary() {
            return new WorkspaceProjectSummary(id, sfdcId, name, customer, category, stage,
                    value, owner, health, updatedAt, diagrams, parts);
        }

        WorkspaceProjectDetail toDetail() {
            return new WorkspaceProjectDetail(id, sfdcId, name, customer, category, stage,
                    value, owner, health, updatedAt, diagrams, parts,
                    artifacts.stream().map(Artifact::toSummary).toList());
        }
    }

    private static final class Artifact {
        final String id;
        String name, folder;
        final String kind, origin;
        Instant updatedAt;
        String author;
        Long size, diagramId;
        DatasetPreview preview;
        String summary;
        byte[] content;

        Artifact(String id, String name, String kind, String folder, Instant updatedAt, String author,
                 Long size, Long diagramId, String origin, DatasetPreview preview, String summary, byte[] content) {
            this.id = id; this.name = name; this.kind = kind; this.folder = folder;
            this.updatedAt = updatedAt; this.author = author; this.size = size; this.diagramId = diagramId;
            this.origin = origin; this.preview = preview; this.summary = summary; this.content = content;
        }

        ArtifactSummary toSummary() {
            return new ArtifactSummary(id, name, kind, folder, updatedAt, author, size, diagramId, origin);
        }

        ArtifactDetail toDetail() {
            return new ArtifactDetail(id, name, kind, folder, updatedAt, author, size, diagramId,
                    origin, preview, summary);
        }
    }
}
