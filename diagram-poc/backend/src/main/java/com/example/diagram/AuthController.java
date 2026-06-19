package com.example.diagram;

import java.util.Map;
import java.util.Optional;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Register / login / logout / me for the password-based, session auth flow.
 * No email verification: {@code /register} creates an active account and signs in
 * immediately. These endpoints are {@code permitAll} in {@link SecurityConfig}.
 *
 * <p>Self-registration can optionally be gated by a shared invite code
 * ({@code app.registration.invite-code}); when set, callers must supply it.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String EMAIL_REGEX = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final AuthenticationManager authenticationManager;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    /** Optional shared invite code; empty/unset means open registration. */
    @Value("${app.registration.invite-code:}")
    private String inviteCode;

    public AuthController(AuthenticationManager authenticationManager,
                          UserRepository users,
                          PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public record RegisterRequest(String name, String email, String password, String inviteCode) {}
    public record LoginRequest(String email, String password) {}

    /** Tells the UI whether to show the invite-code field on the register form. */
    @GetMapping("/config")
    public Map<String, Object> config() {
        return Map.of("inviteRequired", inviteRequired());
    }

    /** Create an account and sign in immediately. */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody RegisterRequest body,
                                                        HttpServletRequest request,
                                                        HttpServletResponse response) {
        String name = body.name() == null ? "" : body.name().trim();
        String email = body.email() == null ? "" : body.email().trim().toLowerCase();
        String password = body.password() == null ? "" : body.password();

        if (inviteRequired()
                && (body.inviteCode() == null || !inviteCode.equals(body.inviteCode().trim()))) {
            return badRequest("Invalid invite code.");
        }
        if (name.isEmpty()) {
            return badRequest("Enter your name.");
        }
        if (name.length() > 80) {
            return badRequest("Name is too long (max 80 characters).");
        }
        if (!email.matches(EMAIL_REGEX)) {
            return badRequest("Enter a valid email address.");
        }
        if (password.length() < MIN_PASSWORD_LENGTH) {
            return badRequest("Password must be at least " + MIN_PASSWORD_LENGTH + " characters.");
        }

        Optional<User> existing = users.findByEmail(email);
        User user;
        if (existing.isPresent()) {
            user = existing.get();
            if (user.isEnabled()) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("message", "That email is already registered. Try signing in."));
            }
            // Legacy/disabled row — treat this as a fresh registration.
        } else {
            user = new User();
            user.setEmail(email);
        }
        user.setName(name);
        user.setPassword(passwordEncoder.encode(password));
        user.setEnabled(true);
        users.save(user);

        startSession(email, password, request, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(payloadFor(email));
    }

    /** Authenticate and start a session. */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest body,
                                                     HttpServletRequest request,
                                                     HttpServletResponse response) {
        String email = body.email() == null ? "" : body.email().trim().toLowerCase();
        try {
            startSession(email, body.password(), request, response);
            return ResponseEntity.ok(payloadFor(email));
        } catch (DisabledException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "This account isn't active. Please register again."));
        } catch (AuthenticationException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid email or password."));
        }
    }

    /** The current user, or 401 if the session isn't authenticated. */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Not authenticated"));
        }
        return ResponseEntity.ok(payloadFor(authentication.getName()));
    }

    /** End the session and clear the security context. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    /** Authenticate the credentials and persist the session (issues JSESSIONID). */
    private void startSession(String email, String rawPassword,
                              HttpServletRequest request, HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, rawPassword));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    private Map<String, Object> payloadFor(String email) {
        String name = users.findByEmail(email).map(User::getName).orElse(null);
        return Map.of("email", email, "name", name == null ? "" : name);
    }

    private boolean inviteRequired() {
        return inviteCode != null && !inviteCode.isBlank();
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }
}
