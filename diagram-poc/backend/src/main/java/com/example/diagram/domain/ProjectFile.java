package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A file stored against a project — e.g. a part datasheet pulled in when a part
 * is linked. Downloaded once and kept here, so the workspace owns a local copy
 * instead of linking out to another site every time.
 */
@Entity
@Table(name = "project_files",
        uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "source_url"}))
public class ProjectFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(nullable = false)
    private String name;

    /** Tree folder, e.g. "Documents". */
    private String folder;

    private String contentType;
    private long sizeBytes;

    /** Where it was fetched from, so the same source is not stored twice. */
    @Column(name = "source_url", length = 2048)
    private String sourceUrl;

    private String linkedBy;

    @Lob
    @Column(name = "bytes", columnDefinition = "BLOB")
    private byte[] bytes;

    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFolder() { return folder; }
    public void setFolder(String folder) { this.folder = folder; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getLinkedBy() { return linkedBy; }
    public void setLinkedBy(String linkedBy) { this.linkedBy = linkedBy; }
    public byte[] getBytes() { return bytes; }
    public void setBytes(byte[] bytes) { this.bytes = bytes; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
