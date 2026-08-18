package com.arrow.dws.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The whole application, wired as it ships.
 *
 * <p>Worth running end to end for two things a unit test cannot see: that
 * Spring actually discovers all seven contributors, and that the endpoint
 * answers without a session.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OpportunityControllerTest {

    private static final String EV_BMS = "0061t00000AbCdEfGhI";

    @Autowired
    private MockMvc mvc;

    @Test
    void returnsEverySevenTabsInOrderWithoutAuthentication() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.opportunityId").value(EV_BMS))
                .andExpect(jsonPath("$.designId").value("PRJ-001"))
                .andExpect(jsonPath("$.customer").value("Tesla Motors"))
                .andExpect(jsonPath("$.tabs.length()").value(7))
                .andExpect(jsonPath("$.tabs[0].key").value("overview"))
                .andExpect(jsonPath("$.tabs[1].key").value("block-diagrams"))
                .andExpect(jsonPath("$.tabs[2].key").value("part-intel"))
                .andExpect(jsonPath("$.tabs[3].key").value("fast-repo"))
                .andExpect(jsonPath("$.tabs[4].key").value("support"))
                .andExpect(jsonPath("$.tabs[5].key").value("ai-assistant"))
                .andExpect(jsonPath("$.tabs[6].key").value("supplier-collab"));
    }

    @Test
    void nestsFieldsInsideItemsInsideTabs() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS))
                .andExpect(jsonPath("$.tabs[0].fields[0].key").value("designId"))
                .andExpect(jsonPath("$.tabs[0].fields[0].value").value("PRJ-001"))
                .andExpect(jsonPath("$.tabs[0].fields[0].tone").value("neutral"))
                .andExpect(jsonPath("$.tabs[1].items[0].title").value("Power Architecture"))
                .andExpect(jsonPath("$.tabs[1].items[0].fields[0].key").value("revision"))
                .andExpect(jsonPath("$.tabs[1].items[0].fields[1].tone").value("positive"));
    }

    /** Omitting the parameter must not accidentally serve the internal variant. */
    @Test
    void defaultsToTheEmbeddedAudience() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS))
                .andExpect(jsonPath("$.audience").value("embedded"))
                .andExpect(jsonPath("$.tabs[0].readOnly").value(true))
                .andExpect(jsonPath("$.tabs[3].items.length()").value(2));
    }

    @Test
    void embedFalseReturnsTheInternalVariant() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS).param("embed", "false"))
                .andExpect(jsonPath("$.audience").value("internal"))
                .andExpect(jsonPath("$.tabs[0].readOnly").value(false))
                .andExpect(jsonPath("$.tabs[3].items.length()").value(4));
    }

    @Test
    void unknownOpportunityIsAStructured404() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", "0061t00000NoSuchId"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value(
                        "No design is linked to opportunity 0061t00000NoSuchId"))
                .andExpect(jsonPath("$.path").value(
                        "/api/sfdc/opportunities/0061t00000NoSuchId/tabs"));
    }

    /** Nulls are omitted, so a null in the payload always means something. */
    @Test
    void omitsNullsRatherThanShippingThem() throws Exception {
        mvc.perform(get("/api/sfdc/opportunities/{id}/tabs", EV_BMS))
                .andExpect(jsonPath("$.tabs[0].badge").doesNotExist())
                .andExpect(jsonPath("$.tabs[0].note").doesNotExist())
                .andExpect(jsonPath("$.tabs[1].badge").value("3"));
    }
}
