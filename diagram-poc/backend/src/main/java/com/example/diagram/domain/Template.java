package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A reusable diagram template in the shared repository. Templates are a living
 * library: anyone can <em>use</em> one to start a new diagram, <em>improve</em>
 * an existing one (the content is updated in place and the editor recorded), or
 * <em>save</em> their canvas as a brand-new template. {@code usageCount} tracks
 * how often a template has been used so the gallery can surface popular ones.
 */
@Entity
@Table(name = "templates")
public class Template {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 280)
    private String description;

    /** Free-form grouping shown in the gallery, e.g. "Robotics", "Power". */
    private String category;

    /** The diagram content (X6 graph.toJSON()), same format as {@link Diagram}. */
    @Lob
    @Column(name = "content_json", columnDefinition = "CLOB")
    private String contentJson;

    /** Email of the original author (from the authenticated session). */
    private String authorEmail;

    /** Display name of the original author. */
    private String authorName;

    /** Display name of whoever last improved the template (null until improved). */
    private String updatedByName;

    /** How many times this template has been used to start a diagram. */
    @Column(nullable = false)
    private int usageCount = 0;

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

    // --- getters / setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }

    public String getAuthorEmail() { return authorEmail; }
    public void setAuthorEmail(String authorEmail) { this.authorEmail = authorEmail; }

    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    public String getUpdatedByName() { return updatedByName; }
    public void setUpdatedByName(String updatedByName) { this.updatedByName = updatedByName; }

    public int getUsageCount() { return usageCount; }
    public void setUsageCount(int usageCount) { this.usageCount = usageCount; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
