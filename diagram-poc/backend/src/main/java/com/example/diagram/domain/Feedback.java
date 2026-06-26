package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A piece of user feedback ("feedback loop"). Captures a category, a 1-5
 * sentiment score and free-text, optionally tied to a diagram, so the team can
 * close the loop on usability and feature requests.
 */
@Entity
@Table(name = "feedback")
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** general, bug, feature, ai-quality, ... */
    @Column(nullable = false)
    private String category = "general";

    /** 1 (poor) .. 5 (great); 0 if not provided. */
    private int rating;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String message;

    private String userEmail;

    private Long diagramId;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public Long getDiagramId() { return diagramId; }
    public void setDiagramId(Long diagramId) { this.diagramId = diagramId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
