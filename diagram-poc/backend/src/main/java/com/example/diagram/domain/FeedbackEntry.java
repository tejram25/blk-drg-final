package com.example.diagram.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * One turn of a feedback loop: who said it (author + their free-form role tag,
 * e.g. "Sales", "Engineering", "Customer", "QA"), what they said, and the
 * decision it carries (comment / request-changes / approve / close), which
 * drives the parent thread's status.
 */
@Entity
@Table(name = "feedback_entries")
public class FeedbackEntry {

    public static final String COMMENT = "comment";
    public static final String REQUEST_CHANGES = "request-changes";
    public static final String APPROVE = "approve";
    public static final String CLOSE = "close";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "thread_id", nullable = false)
    private Long threadId;

    private String authorEmail;
    private String authorName;

    /** Free-form actor tag ("Sales", "Engineering", "Customer", …) — not an enum. */
    @Column(length = 60)
    private String role;

    @Column(nullable = false, length = 30)
    private String decision = COMMENT;

    @Column(length = 2000)
    private String text;

    private Instant createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getThreadId() { return threadId; }
    public void setThreadId(Long threadId) { this.threadId = threadId; }
    public String getAuthorEmail() { return authorEmail; }
    public void setAuthorEmail(String authorEmail) { this.authorEmail = authorEmail; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
