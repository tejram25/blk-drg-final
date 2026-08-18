package com.arrow.dws.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CORS actually being applied.
 *
 * <p>Worth its own test because the failure is silent: defining a
 * {@code CorsConfigurationSource} without the filter that consumes it starts
 * cleanly, passes every other test, and refuses every browser call. Salesforce
 * is a cross-origin caller by definition, so this is the one piece of
 * configuration that breaks the entire feature without breaking the build.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "dws.cors.allowed-origin-patterns=https://allowed.example.com")
class CorsTest {

    private static final String PATH = "/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs";

    @Autowired
    private MockMvc mvc;

    @Test
    void allowsAConfiguredOrigin() throws Exception {
        mvc.perform(get(PATH).header("Origin", "https://allowed.example.com"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://allowed.example.com"));
    }

    @Test
    void answersThePreflight() throws Exception {
        mvc.perform(options(PATH)
                        .header("Origin", "https://allowed.example.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://allowed.example.com"));
    }

    @Test
    void refusesAnOriginThatIsNotConfigured() throws Exception {
        mvc.perform(get(PATH).header("Origin", "https://not-allowed.example.com"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    /**
     * Credentials off is what makes the wildcard patterns safe. If this ever
     * flips, the origin list has to become exact at the same time.
     */
    @Test
    void doesNotAllowCredentials() throws Exception {
        mvc.perform(get(PATH).header("Origin", "https://allowed.example.com"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }
}
