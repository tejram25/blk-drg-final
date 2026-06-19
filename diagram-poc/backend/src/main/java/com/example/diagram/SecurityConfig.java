package com.example.diagram;

import static org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher;

import java.util.List;

import jakarta.servlet.http.HttpServletResponse;

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
            .authorizeHttpRequests(reg -> reg
                // register / verify / login / logout / me are all open; the rest needs a session
                .requestMatchers(antMatcher("/api/auth/**")).permitAll()
                .requestMatchers(PathRequest.toH2Console()).permitAll()
                .requestMatchers(antMatcher("/error")).permitAll()
                .anyRequest().authenticated())
            // H2 console renders inside a frame
            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
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

    /**
     * CORS with credentials enabled so the session cookie can ride along if the
     * frontend is ever served from a different origin than the API. When served
     * same-origin (recommended — via the Angular dev proxy or a reverse proxy),
     * CORS isn't exercised at all.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
