package com.example.diagram.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MockPartSearchServiceTest {

    private final MockPartSearchService service = new MockPartSearchService(new ObjectMapper());
    private final ObjectMapper om = new ObjectMapper();

    @Test
    void search_matchesByPartNumber() throws Exception {
        String json = service.search("INA250", null, false);
        assertThat(json).contains("INA250A3PWR");
        assertThat(om.readTree(json).at("/partserviceresult/parts").size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void search_matchesByDescription() {
        assertThat(service.search("capacitor", null, false)).contains("GRM188R71H104KA93D");
    }

    @Test
    void search_noMatchReturnsEmpty() throws Exception {
        String json = service.search("zzznotapart", null, false);
        assertThat(om.readTree(json).at("/partserviceresult/parts").size()).isZero();
    }

    @Test
    void search_rejectsBlankQuery() {
        assertThrows(IllegalArgumentException.class, () -> service.search("  ", null, false));
    }
}
