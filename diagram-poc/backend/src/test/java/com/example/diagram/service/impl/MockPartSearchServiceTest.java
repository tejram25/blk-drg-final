package com.example.diagram.service.impl;

import com.example.diagram.service.PartSearchNormalizer;
import com.example.diagram.web.dto.PartSearchResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MockPartSearchServiceTest {

    private final MockPartSearchService service =
            new MockPartSearchService(new ObjectMapper(), new PartSearchNormalizer());

    private PartSearchResponse search(String q) {
        return service.search(q, null, false, false, 0, 25);
    }

    @Test
    void search_matchesByPartNumber() {
        PartSearchResponse res = search("INA250");
        assertThat(res.parts()).isNotEmpty();
        assertThat(res.parts().get(0).partNumber()).contains("INA250A3PWR");
    }

    @Test
    void search_matchesByDescription() {
        assertThat(search("capacitor").parts())
                .extracting(p -> p.partNumber())
                .contains("GRM188R71H104KA93D");
    }

    @Test
    void search_noMatchReturnsEmpty() {
        assertThat(search("zzznotapart").parts()).isEmpty();
    }

    @Test
    void search_rejectsBlankQuery() {
        assertThrows(IllegalArgumentException.class, () -> search("  "));
    }
}
