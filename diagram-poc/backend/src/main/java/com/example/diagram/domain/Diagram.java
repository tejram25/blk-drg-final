package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "diagrams")
public class Diagram {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /**
     * The full diagram serialized by the frontend (X6 graph.toJSON()).
     * Stored as plain text in H2 for the POC; use a JSONB column in PostgreSQL.
     */
    @Lob
    @Column(name = "content_json", columnDefinition = "CLOB")
    private String contentJson;

    /**
     * Access classification: PUBLIC, INTERNAL (default), or RESTRICTED (ITAR/export-control).
     * Left nullable at the DB level so {@code ddl-auto=update} can add this column to an
     * existing {@code diagrams} table that already has rows; a stored null is treated as
     * INTERNAL throughout the service layer.
     */
    private String classification = "INTERNAL";

    /** Email of the creator; RESTRICTED diagrams are visible only to the owner. */
    private String ownerEmail;

    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = Instant.now();
    }

    // --- getters / setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }

    public String getClassification() { return classification; }
    public void setClassification(String classification) { this.classification = classification; }

    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
