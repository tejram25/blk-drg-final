package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * An audit / adoption-metrics record. One row is written every time a user
 * opens, creates, saves or deletes a diagram (and for sign-in events), so the
 * team can answer "who touched this RESTRICTED file?" and "how is the tool
 * being adopted across regions?".
 */
@Entity
@Table(name = "usage_events")
public class UsageEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** e.g. diagram.open, diagram.create, diagram.save, diagram.delete. */
    @Column(nullable = false)
    private String action;

    /** Who performed the action (authenticated email, or "anonymous"). */
    private String userEmail;

    /** Coarse region bucket derived from the user, for regional adoption metrics. */
    private String region;

    /** Classification of the affected diagram, when applicable. */
    private String classification;

    private Long diagramId;

    @Column(nullable = false)
    private Instant occurredAt = Instant.now();

    public UsageEvent() {
    }

    public UsageEvent(String action, String userEmail, String region,
                      String classification, Long diagramId) {
        this.action = action;
        this.userEmail = userEmail;
        this.region = region;
        this.classification = classification;
        this.diagramId = diagramId;
        this.occurredAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getClassification() { return classification; }
    public void setClassification(String classification) { this.classification = classification; }

    public Long getDiagramId() { return diagramId; }
    public void setDiagramId(Long diagramId) { this.diagramId = diagramId; }

    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
}
