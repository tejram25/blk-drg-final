package com.example.diagram;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A registered account. Named {@code AppUser} (not {@code User}) to avoid
 * clashing with Spring Security's {@code org.springframework.security...User}.
 */
@Entity
@Table(name = "users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Login identifier; stored normalized (trimmed + lower-cased). */
    @Column(nullable = false, unique = true)
    private String email;

    private String name;

    /** BCrypt hash — never the raw password. */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    private Instant createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = Instant.now();
    }

    // --- getters / setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
