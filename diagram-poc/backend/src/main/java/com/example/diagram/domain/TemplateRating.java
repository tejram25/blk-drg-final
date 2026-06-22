package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A user's 1-5 star rating of a template. Each user rates a template at most
 * once (unique constraint); rating again updates the existing row. Kept simple
 * (no comment) — templates are rated for "how useful a starting point is".
 */
@Entity
@Table(name = "template_ratings",
        uniqueConstraints = @UniqueConstraint(name = "uq_trating_template_user",
                columnNames = {"template_id", "user_email"}))
public class TemplateRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "template_id", nullable = false)
    private Long templateId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(nullable = false)
    private int rating;

    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = Instant.now();
    }

    // --- getters / setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTemplateId() { return templateId; }
    public void setTemplateId(Long templateId) { this.templateId = templateId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
