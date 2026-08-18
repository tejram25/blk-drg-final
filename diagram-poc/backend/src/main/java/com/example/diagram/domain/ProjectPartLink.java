package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A catalogue part linked to a project — one line of the project's Bill of
 * materials. Persisted so links survive a refresh, unlike the in-memory demo
 * state they replace.
 *
 * <p>The full normalised part (a {@code CatalogPart}) is stored as JSON in
 * {@code partJson}, so the UI can rehydrate the whole card without a second
 * catalogue call; the flat columns exist for querying and to render a BOM
 * without parsing the blob.
 */
@Entity
@Table(name = "project_part_links",
        uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "part_id"}))
public class ProjectPartLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    /** Catalogue item id — unique per part within a project. */
    @Column(name = "part_id", nullable = false)
    private String partId;

    private String partNumber;
    private String manufacturer;
    @Column(length = 1024)
    private String description;
    private String status;
    private String unitPrice;
    private String currency;
    private int quantity;

    /** Who linked it, for provenance. */
    private String linkedBy;

    /** The full normalised CatalogPart, so the UI can rebuild the card offline. */
    @Lob
    @Column(name = "part_json", columnDefinition = "CLOB")
    private String partJson;

    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = Instant.now();
    }

    // --- getters / setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getPartId() { return partId; }
    public void setPartId(String partId) { this.partId = partId; }
    public String getPartNumber() { return partNumber; }
    public void setPartNumber(String partNumber) { this.partNumber = partNumber; }
    public String getManufacturer() { return manufacturer; }
    public void setManufacturer(String manufacturer) { this.manufacturer = manufacturer; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getUnitPrice() { return unitPrice; }
    public void setUnitPrice(String unitPrice) { this.unitPrice = unitPrice; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public String getLinkedBy() { return linkedBy; }
    public void setLinkedBy(String linkedBy) { this.linkedBy = linkedBy; }
    public String getPartJson() { return partJson; }
    public void setPartJson(String partJson) { this.partJson = partJson; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
