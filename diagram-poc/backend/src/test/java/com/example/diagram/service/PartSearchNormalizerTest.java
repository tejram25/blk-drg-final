package com.example.diagram.service;

import com.example.diagram.web.dto.CatalogPart;
import com.example.diagram.web.dto.PartSearchResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Normalisation of a real catalogue payload — the LTC1732 response from the
 * part-search team, which carries the sourcing fields the earlier sample did not
 * and is the case where Arrow holds no stock but the supplier does.
 */
class PartSearchNormalizerTest {

    private final PartSearchNormalizer normalizer = new PartSearchNormalizer();
    private final ObjectMapper mapper = new ObjectMapper();

    private CatalogPart part() throws Exception {
        try (InputStream in = getClass().getResourceAsStream("/part-search-extra-fields.json")) {
            PartSearchResponse res = normalizer.normalize(mapper.readTree(in), "LTC1732EMS-4.2#PBF");
            assertEquals(1, res.parts().size());
            return res.parts().get(0);
        }
    }

    @Test
    void readsIdentityAndCategory() throws Exception {
        CatalogPart p = part();
        assertEquals("LTC1732EMS-4.2#PBF", p.partNumber());
        assertEquals("Analog Devices", p.manufacturer());
        assertEquals("Battery Management", p.category());
        assertTrue(p.exactMatch());
    }

    /**
     * The point of the new fields: on-hand is zero everywhere, so "0 in stock"
     * is all the old model could say. The supplier holds 20,050 with a factory
     * date, which is the actual answer to "when can I get it?".
     */
    @Test
    void carriesSupplierAvailabilityWhenArrowHasNoStock() throws Exception {
        CatalogPart p = part();
        assertEquals(0, p.stock().totalOnHand());
        assertEquals(0, p.stock().inStockLocations());
        assertEquals(20050, p.leadTime().supplierAvailable());
        assertEquals("23-Jul-2026", p.leadTime().factoryStockDate());
        assertEquals("10", p.leadTime().arrowWeeks());
    }

    @Test
    void readsSourcingSignals() throws Exception {
        CatalogPart p = part();
        assertEquals("NONE", p.sourcing().allocation());
        assertTrue(p.sourcing().franchised(), "franchised is \"Y\"");
        assertTrue(p.sourcing().changeNotice(), "pcn.ind is \"Yes\"");
        assertFalse(p.sourcing().ncnr(), "ncnr.custContractReq is \"No\"");
        assertFalse(p.sourcing().soleSource());
        assertTrue(p.sourcing().backorderable(), "bkordind is \"Y\"");
        assertFalse(p.sourcing().militarySpec());
        assertFalse(p.sourcing().ftzEnabled());
        assertEquals("D", p.sourcing().partClass());
    }

    @Test
    void readsPackagingStyleAndRelationships() throws Exception {
        CatalogPart p = part();
        assertEquals("RAIL", p.packaging().packageType());
        assertEquals("TUBE", p.packaging().packageStyle());
        assertEquals(150, p.packaging().minOrderQty());
        assertEquals(50, p.packaging().multipleQty());
        assertTrue(p.relatedTypes().contains("Marketing Equivalent"));
        assertTrue(p.crossRefTypes().contains("Part Rename"));
    }

    @Test
    void readsPricingLadderAndCompliance() throws Exception {
        CatalogPart p = part();
        assertEquals(3, p.pricing().breaks().size());
        assertEquals("USD", p.pricing().currency());
        assertEquals("5.279199", p.pricing().unitPrice());
        assertTrue(p.compliance().standards().contains("EU ROHS"));
        assertFalse(p.compliance().svhc(), "svhcInclude is \"NO\"");
        assertEquals("EAR99", p.compliance().eccnUs());
    }

    /**
     * Arrow's cost basis and internal win scores sit in the same upstream object
     * as the fields above. They must not be serialisable out of this API.
     */
    @Test
    void doesNotCarryInternalCostData() throws Exception {
        String json = mapper.writeValueAsString(part());
        for (String field : new String[] {
                "refBussCost", "bestBussCost", "suppCanWin", "salesCanWin", "alcCost" }) {
            assertFalse(json.contains(field), "internal field leaked: " + field);
        }
        assertFalse(json.contains("3.16224"), "refBussCost value leaked");
        assertFalse(json.contains("2.74802"), "bestBussCost value leaked");
    }

    /**
     * Part numbers legitimately contain '#' (LTC1732EMS-4.2#PBF). Unencoded it
     * would start a URI fragment and truncate the query, so the search URL must
     * carry it percent-encoded.
     */
    @Test
    void encodesHashInPartNumberForUpstreamQuery() {
        String url = UriComponentsBuilder.fromHttpUrl("https://example.test/acpartservice/search")
                .queryParam("srchtxt", "LTC1732EMS-4.2#PBF")
                .encode().build().toUriString();
        assertTrue(url.contains("srchtxt=LTC1732EMS-4.2%23PBF"), url);
        assertFalse(url.contains("#PBF"), url);
    }
}
