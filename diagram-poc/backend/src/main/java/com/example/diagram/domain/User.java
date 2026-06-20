package com.example.diagram.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A registered account. Created and active on self-registration — there's no email
 * verification. No roles are stored; authorization is simply "logged-in vs not".
 *
 * <p>Table is named {@code app_users} because {@code user} is a reserved word in H2.
 */
@Entity
@Table(name = "app_users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /** Display name shown in the app after sign-in. */
    @Column(length = 80)
    private String name;

    /** BCrypt hash — never plaintext. */
    @Column(nullable = false)
    private String password;

    /** Active flag. True on registration; reserved for disabling accounts later. */
    @Column(nullable = false)
    private boolean enabled = true;

    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
