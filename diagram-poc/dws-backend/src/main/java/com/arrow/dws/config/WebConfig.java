package com.arrow.dws.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Clock;
import java.util.List;

/** Web-layer wiring: CORS, and the clock everything else asks for. */
@Configuration
@EnableConfigurationProperties(CorsProperties.class)
public class WebConfig {

    /**
     * The one clock. Injecting it rather than calling {@code Instant.now()}
     * means a test can fix time instead of asserting "roughly now".
     */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /**
     * CORS for the Salesforce embed.
     *
     * <p>Credentials are <b>not</b> allowed, because this API has no session to
     * carry. That is what makes the wildcard patterns safe here: with
     * credentials off, a matching origin gains nothing it could not get from a
     * server-side call anyway. If authentication is added later, this pairing
     * has to be revisited in the same change.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(properties.getAllowedOriginPatterns());
        config.setAllowedMethods(List.of("GET", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Accept", "Origin"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
