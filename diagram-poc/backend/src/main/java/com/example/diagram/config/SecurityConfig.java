package com.example.diagram.config;

import static org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher;

import java.util.Arrays;
import java.util.List;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.security.servlet.PathRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Session-based authentication for the diagram API.
 *
 * <p>Accounts live in the database (see {@link UserDetailsServiceImpl}) and are
 * created via self-registration with email verification — there are no seeded
 * accounts. Authorization is "logged-in vs not": every endpoint under
 * {@code /api/**} except {@code /api/auth/**} requires an authenticated session.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Whether the H2 web console is enabled (off by default; dev-only). */
    @Value("${spring.h2.console.enabled:false}")
    private boolean h2ConsoleEnabled;

    /** BCrypt for hashing/checking passwords. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * AuthenticationManager backed by {@link UserDetailsServiceImpl} + the
     * PasswordEncoder above (both picked up automatically). Used by AuthController.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            // CSRF is disabled for this POC: it's a session-cookie SPA served same-origin
            // (Angular dev proxy in dev, reverse proxy in prod). To turn CSRF on, switch to
            // CookieCsrfTokenRepository.withHttpOnlyFalse() and let Angular's HttpClient echo
            // the XSRF-TOKEN cookie back as the X-XSRF-TOKEN header. See README "Security notes".
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(reg -> {
                // register / verify / login / logout / me are all open; the rest needs a session
                reg.requestMatchers(antMatcher("/api/auth/**")).permitAll();
                // Public health/info so IT monitoring can poll uptime
                reg.requestMatchers(antMatcher("/actuator/health"), antMatcher("/actuator/info")).permitAll();
                // Only expose the H2 console route when it is actually enabled (dev only).
                if (h2ConsoleEnabled) {
                    reg.requestMatchers(PathRequest.toH2Console()).permitAll();
                }
                reg.requestMatchers(antMatcher("/error")).permitAll();
                reg.anyRequest().authenticated();
            })
            // Deny framing by default (clickjacking protection); allow same-origin
            // framing only when the H2 console (which renders in a frame) is enabled.
            .headers(headers -> headers.frameOptions(frame -> {
                if (h2ConsoleEnabled) frame.sameOrigin(); else frame.deny();
            }))
            // Create a session at login and reuse it (this is the auth state)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            // Return 401 (not a 302 redirect) for unauthenticated API calls so the SPA can react
            .exceptionHandling(ex -> ex.authenticationEntryPoint(
                (request, response, authEx) ->
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized")))
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .logout(logout -> logout.disable()); // logout is handled by AuthController
        return http.build();
    }

    /** Comma-separated allowlist of browser-origin PATTERNS permitted to send
     * credentialed requests. Wildcards are allowed (e.g. {@code https://*.arrow.com})
     * because we use {@code setAllowedOriginPatterns}, which — unlike a bare "*"
     * with allowCredentials — reflects ONLY origins that match a pattern, so a
     * random site still can't read a signed-in user's data.
     *
     * Defaults cover local dev AND the Arrow corporate domain, so the standard
     * same-origin reverse-proxy deployment (e.g. https://usdendrh5070.arrow.com,
     * where the browser sends that Origin header even on same-origin POSTs and the
     * backend can't detect same-origin behind the proxy) works out of the box.
     * Override with APP_CORS_ALLOWED_ORIGINS for other hosts. */
    @Value("${app.cors.allowed-origins:http://localhost:4200,http://localhost:4300,https://*.arrow.com}")
    private String allowedOrigins;

    /**
     * CORS with credentials enabled so the session cookie can ride along. Origins
     * are matched against an explicit pattern allowlist (never a bare "*") because
     * credentials are allowed. When served truly same-origin, CORS isn't exercised;
     * but behind a reverse proxy the backend often can't tell a same-origin request
     * from a cross-origin one, so the deployment origin must still be allowlisted.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> patterns = Arrays.stream(allowedOrigins.split(","))
            .map(String::trim).filter(s -> !s.isEmpty()).toList();
        config.setAllowedOriginPatterns(patterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "X-Requested-With", "Accept", "Origin", "X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
