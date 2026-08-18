package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A feedback loop on a diagram: a threaded review conversation between whoever
 * works on it (sales, engineering, customer, QA… — roles are free-form tags on
 * each entry, not a fixed set of actors). The thread's status is driven by the
 * decisions of its entries: open → changes-requested → approved → closed.
 * Optionally anchored to one block ({@code nodeId}).
 */
@Entity
@Table(name = "feedback_threads")
public class FeedbackThread {

    public static final String OPEN = "open";
    public static final String CHANGES_REQUESTED = "changes-requested";
    public static final String APPROVED = "approved";
    public static final String CLOSED = "closed";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "diagram_id", nullable = false)
    private Long diagramId;

    @Column(nullable = false, length = 200)
    private String title;

    /** Id of the block this loop is anchored to, or null for the whole diagram. */
    private String nodeId;

    @Column(nullable = false, length = 30)
    private String status = OPEN;

    private String createdByEmail;
    private String createdByName;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getDiagramId() { return diagramId; }
    public void setDiagramId(Long diagramId) { this.diagramId = diagramId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCreatedByEmail() { return createdByEmail; }
    public void setCreatedByEmail(String createdByEmail) { this.createdByEmail = createdByEmail; }
    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
