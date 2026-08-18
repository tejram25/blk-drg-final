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
 * The shipped default: allow every origin.
 *
 * <p>The Salesforce org is not known yet, so the wildcard is deliberate — this
 * pins that an arbitrary origin is accepted, and that even under the wildcard
 * credentials stay off, which is the only thing that makes it safe. If someone
 * later narrows the default and forgets a real Salesforce host, this test still
 * passes (it configures its own {@code *}); the guard that matters is
 * {@link CorsTest#doesNotAllowCredentials()} plus this one holding the pairing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "dws.cors.allowed-origin-patterns=*")
class CorsWildcardTest {

    private static final String PATH = "/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs";

    @Autowired
    private MockMvc mvc;

    @Test
    void allowsAnArbitraryOrigin() throws Exception {
        mvc.perform(get(PATH).header("Origin", "https://anything.example.org"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://anything.example.org"));
    }

    @Test
    void allowsTheArtifactsEndpointToo() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/0061t00000AbCdEfGhI/artifacts")
                        .header("Origin", "https://some-sandbox.my.salesforce.com"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        "Access-Control-Allow-Origin", "https://some-sandbox.my.salesforce.com"));
    }

    @Test
    void answersThePreflightForAnyOrigin() throws Exception {
        mvc.perform(options(PATH)
                        .header("Origin", "https://whoever.example.net")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://whoever.example.net"));
    }

    /** A wildcard origin with credentials on would be a real hole. It stays off. */
    @Test
    void stillDoesNotAllowCredentialsUnderTheWildcard() throws Exception {
        mvc.perform(get(PATH).header("Origin", "https://anything.example.org"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }
}
