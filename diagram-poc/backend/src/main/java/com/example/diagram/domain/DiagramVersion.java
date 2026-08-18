package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** An immutable snapshot of a diagram's content, captured for version history. */
@Entity
@Table(name = "diagram_versions")
public class DiagramVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "diagram_id", nullable = false)
    private Long diagramId;

    private String label;

    @Lob
    @Column(name = "content_json", columnDefinition = "CLOB")
    private String contentJson;

    private String authorEmail;
    private String authorName;
    private Instant createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getDiagramId() { return diagramId; }
    public void setDiagramId(Long diagramId) { this.diagramId = diagramId; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }

    public String getAuthorEmail() { return authorEmail; }
    public void setAuthorEmail(String authorEmail) { this.authorEmail = authorEmail; }

    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
