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
        props.setBaseUrl("https://example.test");
        props.setTokenPath("/auth/oauth2/token");
        props.setSearchPath("/partservice/search");
        props.setVersion("v1");
        if (configured) {
            props.setClientId("id");
            props.setClientSecret("secret");
        }
        return new ArrowPartSearchService(props, new ObjectMapper());
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
}
