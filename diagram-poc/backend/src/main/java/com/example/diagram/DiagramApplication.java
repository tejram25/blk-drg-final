package com.example.diagram;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Application entry point.
 *
 * <p>CORS is configured in {@link SecurityConfig} (a credentials-aware
 * {@code CorsConfigurationSource} wired into the Spring Security filter chain),
 * so it lives in one place alongside the auth rules.
 */
@SpringBootApplication
public class DiagramApplication {

    public static void main(String[] args) {
        SpringApplication.run(DiagramApplication.class, args);
    }
}
