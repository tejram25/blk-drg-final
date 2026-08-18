package com.example.diagram.service.impl;

import com.example.diagram.service.PartSearchNormalizer;
import com.example.diagram.web.dto.CatalogPart;
import com.example.diagram.web.dto.PartSearchResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MockPartSearchServiceTest {

    private final MockPartSearchService service =
            new MockPartSearchService(new ObjectMapper(), new PartSearchNormalizer());

    private PartSearchResponse search(String q) {
        return service.search(q, null, false, false, 0, 50);
    }

    @Test
    void search_matchesByPartNumber() {
        assertThat(search("INA250").parts())
                .extracting(CatalogPart::partNumber)
                .anyMatch(pn -> pn != null && pn.contains("INA250"));
    }

    @Test
    void search_matchesByDescription() {
        assertThat(search("capacitor").parts())
                .extracting(CatalogPart::partNumber)
                .contains("GRM188R71H104KA93D");
    }

    @Test
    void search_noMatchReturnsEmpty() {
        PartSearchResponse r = search("zzznotapart");
        assertThat(r.parts()).isEmpty();
        assertThat(r.returned()).isZero();
        assertThat(r.hasMore()).isFalse();
    }

    @Test
    void search_rejectsBlankQuery() {
        assertThrows(IllegalArgumentException.class, () -> search("  "));
    }
}
