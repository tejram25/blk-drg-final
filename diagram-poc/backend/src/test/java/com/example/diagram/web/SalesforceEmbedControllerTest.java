package com.example.diagram.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Runs against the real filter chain, because the thing most worth proving is
 * that the endpoint answers without a session — the whole point of the POC
 * arrangement, and the easiest thing to break with a one-line security change.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SalesforceEmbedControllerTest {

    private static final String EV_BMS = "0061t00000AbCdEfGhI";

    @Autowired
    private MockMvc mvc;

    @Test
    void answersWithoutAuthentication() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS).param("embed", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.opportunityId").value(EV_BMS))
                .andExpect(jsonPath("$.projectId").value("PRJ-001"))
                .andExpect(jsonPath("$.embed").value(true))
                .andExpect(jsonPath("$.tabs.length()").value(7))
                .andExpect(jsonPath("$.tabs[0].key").value("overview"))
                .andExpect(jsonPath("$.tabs[0].contentType").value("text/html"))
                .andExpect(jsonPath("$.tabs[0].html").isNotEmpty());
    }

    /** Omitting the parameter must not accidentally serve the internal variant. */
    @Test
    void defaultsToTheEmbeddedVariant() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.embed").value(true))
                .andExpect(jsonPath("$.tabs[0].readOnly").value(true));
    }

    @Test
    void embedFalseReturnsTheInternalVariant() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS).param("embed", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.embed").value(false))
                .andExpect(jsonPath("$.tabs[0].readOnly").value(false));
    }

    @Test
    void unknownOpportunityIsNotFound() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", "0061t00000NoSuchId"))
                .andExpect(status().isNotFound());
    }

    /** The other API is still protected — opening this one up must not open others. */
    @Test
    void otherEndpointsStillRequireASession() throws Exception {
        mvc.perform(get("/api/diagrams"))
                .andExpect(status().isUnauthorized());
    }
}
