package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.config.Region;
import com.example.diagram.service.PartSearchNormalizer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ArrowPartSearchServiceTest {

    private ArrowPartSearchService service(boolean configured) {
        ArrowProperties props = new ArrowProperties();
        props.setAuthBaseUrl("https://auth.example.test");
        props.setSearchBaseUrl("https://search.example.test");
        props.setTokenPath("/auth/oauth2/token");
        props.setSearchPath("/arrowapi/dw/partservice/search");
        props.setAppId("gen");
        props.setVersion("v1");
        if (configured) {
            props.setClientId("id");
            props.setClientSecret("secret");
        }
        return new ArrowPartSearchService(props, new ArrowApiClient(props, new ObjectMapper()),
                new PartSearchNormalizer(), new ObjectMapper());
    }

    @Test
    void search_rejectsBlankQuery() {
        assertThrows(IllegalArgumentException.class, () -> service(true).search("  ", null, false, false, 0, 25, Region.EU));
    }

    @Test
    void search_returns503WhenNotConfigured() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service(false).search("INA250", null, false, false, 0, 25, Region.EU));
        assertThat(ex.getStatusCode().value()).isEqualTo(503);
    }

    /**
     * The region is the path prefix and also selects the warehouse list, so a
     * wrong region returns another region's stock rather than an error.
     */
    @Test
    void buildsPerRegionUrls() {
        ArrowProperties props = configured();
        props.setInvOrgs(Map.of(
                Region.EU, "E21,E22",
                Region.AP, "P41,P42",
                Region.AC, "V36,V72,VAG"));
        ArrowPartSearchService svc = service(props);

        assertThat(svc.searchUrl("BAV99", 0, 25, Region.EU))
                .contains("/eupartservice/search").containsPattern("ioebs=E21(,|%2C)E22");
        assertThat(svc.searchUrl("BAV99", 0, 25, Region.AP))
                .contains("/appartservice/search").containsPattern("ioebs=P41(,|%2C)P42");
        assertThat(svc.searchUrl("BAV99", 0, 25, Region.AC))
                .contains("/acpartservice/search").containsPattern("ioebs=V36(,|%2C)V72(,|%2C)VAG");
    }

    /** Reproduces the URL the part-search team supplied. */
    @Test
    void buildsDocumentedAcQuery() {
        ArrowProperties props = configured();
        props.setInvOrgs(Map.of(Region.AC, "V36,V72,VAG"));
        String url = service(props).searchUrl("BAV99", 50, 25, Region.AC);

        assertThat(url).contains("srchtxt=BAV99")
                .contains("source=Workbench")
                .contains("srchmode=EBS")
                .contains("whsetype=2")
                .contains("retWhseFilter=Y")
                .contains("ftzBoostFlag=Y")
                .contains("enableStcFlagFilter=N")
                .contains("limit=25")
                .contains("start=50")
                // 1-based page, derived from the offset so the two agree
                .contains("page=3");
    }

    @Test
    void nullRegionFallsBackToConfiguredDefault() {
        ArrowProperties props = configured();
        props.setRegion(Region.AP);
        assertThat(service(props).searchUrl("BAV99", 0, 25, null))
                .contains("/appartservice/search");
    }

    /** An explicit search-path overrides the derived one for every region. */
    @Test
    void explicitSearchPathOverridesRegionPath() {
        ArrowProperties props = configured();
        props.setSearchPath("/legacy/partservice/search");
        assertThat(service(props).searchUrl("BAV99", 0, 25, Region.AC))
                .contains("/legacy/partservice/search")
                .doesNotContain("acpartservice");
    }

    @Test
    void rejectsUnknownRegion() {
        assertThrows(IllegalArgumentException.class, () -> Region.of("zz"));
        assertThat(Region.of("AC")).isEqualTo(Region.AC);
        assertThat(Region.orDefault("", Region.AP)).isEqualTo(Region.AP);
    }

    /**
     * Part numbers legitimately contain '#'. Unencoded it opens a URI fragment
     * and truncates every parameter after it.
     */
    @Test
    void encodesHashInPartNumber() {
        for (Region r : Region.values()) {
            assertThat(service(configured()).searchUrl("LTC1732EMS-4.2#PBF", 0, 25, r))
                    .as("%s", r)
                    .contains("srchtxt=LTC1732EMS-4.2%23PBF")
                    .doesNotContain("#PBF");
        }
    }

    private ArrowPartSearchService service(ArrowProperties props) {
        return new ArrowPartSearchService(props, new ArrowApiClient(props, new ObjectMapper()),
                new PartSearchNormalizer(), new ObjectMapper());
    }

    private ArrowProperties configured() {
        ArrowProperties props = new ArrowProperties();
        props.setAuthBaseUrl("https://auth.example.test");
        props.setSearchBaseUrl("https://gc-apim-dev1.azure-api.net");
        props.setTokenPath("/auth/oauth2/token");
        props.setAppId("gen");
        props.setVersion("v1");
        props.setClientId("id");
        props.setClientSecret("secret");
        return props;
    }

    @Test
    void buildsDocumentedTokenAndSearchUrls() {
        ArrowProperties props = new ArrowProperties();
        props.setAuthBaseUrl("https://gc-api-dev-apimgwt.apps.usdenpos01.arrow.com");
        props.setSearchBaseUrl("https://gc-apim-dev1.azure-api.net");
        props.setTokenPath("/auth/oauth2/token");
        props.setSearchPath("/arrowapi/dw/partservice/search");

        assertThat(props.tokenUrl())
                .isEqualTo("https://gc-api-dev-apimgwt.apps.usdenpos01.arrow.com/auth/oauth2/token");
        assertThat(props.searchUrl())
                .isEqualTo("https://gc-apim-dev1.azure-api.net/arrowapi/dw/partservice/search");
    }
}
