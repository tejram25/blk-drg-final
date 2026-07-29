package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.service.PartSearchNormalizer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

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
        assertThrows(IllegalArgumentException.class, () -> service(true).search("  ", null, false, false, 0, 25));
    }

    @Test
    void search_returns503WhenNotConfigured() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service(false).search("INA250", null, false, false, 0, 25));
        assertThat(ex.getStatusCode().value()).isEqualTo(503);
    }

    /** The original contract: srchtxt + render + appid, offset paging. */
    @Test
    void buildsPartserviceQuery() {
        String url = service(true).searchUrl("BAV99", 0, 25);
        assertThat(url).contains("srchtxt=BAV99")
                .contains("render=json")
                .contains("appid=gen")
                .contains("start=0")
                .contains("limit=25")
                .doesNotContain("ioebs")
                .doesNotContain("page=");
    }

    /**
     * The Workbench contract. It drops render/appid and takes the warehouse
     * filter and sourcing switches instead, and pages by page as well as offset.
     */
    @Test
    void buildsAcpartserviceQuery() {
        ArrowProperties props = configured();
        props.setSearchApi(ArrowProperties.SearchApi.ACPARTSERVICE);
        props.setSearchPath("/acpartservice/search");
        props.setInvOrgs("V36,V72,V99,VAG");
        ArrowPartSearchService svc = new ArrowPartSearchService(props,
                new ArrowApiClient(props, new ObjectMapper()), new PartSearchNormalizer(), new ObjectMapper());

        String url = svc.searchUrl("BAV99", 50, 25);
        assertThat(url).contains("/acpartservice/search")
                .contains("srchtxt=BAV99")
                .contains("source=Workbench")
                .contains("srchmode=EBS")
                .contains("whsetype=2")
                .contains("retWhseFilter=Y")
                .contains("ftzBoostFlag=Y")
                .contains("enableStcFlagFilter=N")
                .contains("limit=25")
                .contains("start=50")
                // 1-based page, consistent with the offset
                .contains("page=3")
                .doesNotContain("render=json")
                .doesNotContain("appid=");
        // CSV separators must survive encoding as the upstream expects them.
        assertThat(url).containsPattern("ioebs=V36(,|%2C)V72(,|%2C)V99(,|%2C)VAG");
    }

    /**
     * Part numbers legitimately contain '#'. Unencoded it opens a URI fragment
     * and truncates every parameter after it.
     */
    @Test
    void encodesHashInPartNumber() {
        for (ArrowProperties.SearchApi api : ArrowProperties.SearchApi.values()) {
            ArrowProperties props = configured();
            props.setSearchApi(api);
            ArrowPartSearchService svc = new ArrowPartSearchService(props,
                    new ArrowApiClient(props, new ObjectMapper()), new PartSearchNormalizer(), new ObjectMapper());
            String url = svc.searchUrl("LTC1732EMS-4.2#PBF", 0, 25);
            assertThat(url).as("%s", api)
                    .contains("srchtxt=LTC1732EMS-4.2%23PBF")
                    .doesNotContain("#PBF");
        }
    }

    private ArrowProperties configured() {
        ArrowProperties props = new ArrowProperties();
        props.setAuthBaseUrl("https://auth.example.test");
        props.setSearchBaseUrl("https://gc-apim-dev1.azure-api.net");
        props.setTokenPath("/auth/oauth2/token");
        props.setSearchPath("/eupartservice/search");
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
