package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
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
        return new ArrowPartSearchService(props, new ArrowApiClient(props, new ObjectMapper()));
    }

    @Test
    void search_rejectsBlankQuery() {
        assertThrows(IllegalArgumentException.class, () -> service(true).search("  ", null, false));
    }

    @Test
    void search_returns503WhenNotConfigured() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service(false).search("INA250", null, false));
        assertThat(ex.getStatusCode().value()).isEqualTo(503);
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
