package com.example.diagram.service.impl;

import com.example.diagram.config.Region;
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
        return service.search(q, null, false, false, 0, 25, Region.EU);
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

    /**
     * The same part number in two regions must not report the same stock — that
     * is the whole reason region is an input.
     */
    @Test
    void search_variesByRegion() {
        var eu = service.search("LM317T", null, false, false, 0, 25, Region.EU).parts().get(0);
        var ap = service.search("LM317T", null, false, false, 0, 25, Region.AP).parts().get(0);
        assertThat(ap.stock().totalOnHand()).isLessThan(eu.stock().totalOnHand());
        assertThat(Integer.parseInt(ap.leadTime().arrowWeeks()))
                .isGreaterThan(Integer.parseInt(eu.leadTime().arrowWeeks()));
        assertThat(ap.locations().get(0).description()).contains("Asia Pacific");
    }

    @Test
    void search_rejectsBlankQuery() {
        assertThrows(IllegalArgumentException.class, () -> search("  "));
    }
}
