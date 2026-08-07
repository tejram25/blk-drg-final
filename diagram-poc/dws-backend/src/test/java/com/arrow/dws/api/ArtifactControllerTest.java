package com.arrow.dws.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The artifact endpoints, against the app wired as it ships. */
@SpringBootTest
@AutoConfigureMockMvc
class ArtifactControllerTest {

    private static final String RAIL = "0061t00000TuVwXyZaBc";
    private static final String BASE = "/api/sfdc/opportunities/{id}/artifacts";

    @Autowired
    private MockMvc mvc;

    @Test
    void listsArtifactsWithSizesAndDownloadUrls() throws Exception {
        mvc.perform(get(BASE, RAIL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.opportunityId").value(RAIL))
                .andExpect(jsonPath("$.designId").value("PRJ-008"))
                .andExpect(jsonPath("$.audience").value("embedded"))
                .andExpect(jsonPath("$.artifacts[0].id").value("summary"))
                .andExpect(jsonPath("$.artifacts[0].format").value("pdf"))
                .andExpect(jsonPath("$.artifacts[0].mediaType").value("application/pdf"))
                .andExpect(jsonPath("$.artifacts[0].sizeBytes").isNumber())
                .andExpect(jsonPath("$.artifacts[0].downloadUrl")
                        .value("/api/sfdc/opportunities/" + RAIL + "/artifacts/summary"));
    }

    /** The declared total must match the artifacts actually listed. */
    @Test
    void theTotalsDescribeWhatWasReturned() throws Exception {
        String body = mvc.perform(get(BASE, RAIL)).andReturn().getResponse().getContentAsString();

        var json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);
        int declaredCount = json.get("artifactCount").asInt();
        long declaredSize = json.get("totalSizeBytes").asLong();

        assertThat(json.get("artifacts")).hasSize(declaredCount);
        long summed = 0;
        for (var artifact : json.get("artifacts")) {
            summed += artifact.get("sizeBytes").asLong();
        }
        assertThat(declaredSize).isEqualTo(summed);
    }

    @Test
    void downloadsAPngThatIsActuallyAPng() throws Exception {
        // The rail design's approved diagrams are internal, so ask as internal.
        String body = mvc.perform(get(BASE, RAIL).param("embed", "false"))
                .andReturn().getResponse().getContentAsString();
        var json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);
        String pngId = null;
        for (var artifact : json.get("artifacts")) {
            if ("png".equals(artifact.get("format").asText())) {
                pngId = artifact.get("id").asText();
                break;
            }
        }
        assertThat(pngId).as("no PNG artifact in the list").isNotNull();

        MvcResult result = mvc.perform(get(BASE + "/{artifactId}", RAIL, pngId).param("embed", "false"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.startsWith("inline;")))
                .andReturn();

        byte[] png = result.getResponse().getContentAsByteArray();
        assertThat(javax.imageio.ImageIO.read(new ByteArrayInputStream(png))).isNotNull();
    }

    /** A spreadsheet a browser cannot render must download, not display. */
    @Test
    void spreadsheetsAreSentAsAnAttachment() throws Exception {
        mvc.perform(get(BASE + "/{artifactId}", RAIL, "bill-of-materials"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.startsWith("attachment;")));
    }

    @Test
    void contentLengthMatchesTheBytesSent() throws Exception {
        MvcResult result = mvc.perform(get(BASE + "/{artifactId}", RAIL, "summary"))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentAsByteArray())
                .hasSize((int) result.getResponse().getContentLengthLong());
    }

    /**
     * The important one. An artifact the audience may not see must be absent
     * from the list AND unreachable by its id — otherwise the URL is a bypass
     * of the filter the list applies.
     */
    @Test
    void anInternalArtifactIsNeitherListedNorReachableByARestrictedAudience() throws Exception {
        mvc.perform(get(BASE, RAIL))
                .andExpect(jsonPath("$.artifacts[?(@.id == 'query-log')]").isEmpty());

        mvc.perform(get(BASE + "/{artifactId}", RAIL, "query-log"))
                .andExpect(status().isNotFound());

        mvc.perform(get(BASE + "/{artifactId}", RAIL, "query-log").param("embed", "false"))
                .andExpect(status().isOk());
    }

    @Test
    void theInternalVariantListsMore() throws Exception {
        String embedded = mvc.perform(get(BASE, RAIL)).andReturn().getResponse().getContentAsString();
        String internal = mvc.perform(get(BASE, RAIL).param("embed", "false"))
                .andReturn().getResponse().getContentAsString();

        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        int embeddedCount = mapper.readTree(embedded).get("artifactCount").asInt();
        int internalCount = mapper.readTree(internal).get("artifactCount").asInt();

        assertThat(internalCount).isGreaterThan(embeddedCount);
    }

    /**
     * The download name must be readable by whatever asks for it. Spring
     * encodes the plain `filename` as an RFC 2047 word if given a charset;
     * browsers fall back to `filename*` and cope, but curl and most HTTP
     * libraries read `filename` and save `=?UTF-8?Q?...?=` as the file name.
     */
    @Test
    void theDownloadFilenameIsReadableByEveryClient() throws Exception {
        mvc.perform(get(BASE + "/{artifactId}", RAIL, "summary"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("filename=\"PRJ-008 summary.pdf\"")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("=?UTF-8?"))));
    }

    @Test
    void unknownArtifactIsAStructured404() throws Exception {
        mvc.perform(get(BASE + "/{artifactId}", RAIL, "no-such-artifact"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message")
                        .value("No artifact no-such-artifact on opportunity " + RAIL));
    }

    @Test
    void unknownOpportunityIsAStructured404() throws Exception {
        mvc.perform(get(BASE, "0061t00000NoSuchId"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message")
                        .value("No design is linked to opportunity 0061t00000NoSuchId"));
    }
}
