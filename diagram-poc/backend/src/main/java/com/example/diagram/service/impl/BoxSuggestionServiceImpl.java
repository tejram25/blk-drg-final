package com.example.diagram.service.impl;

import com.example.diagram.service.BoxSuggestionService;
import com.example.diagram.service.DesignWinService;
import com.example.diagram.service.PartSearchService;
import com.example.diagram.web.dto.BoxSuggestion;
import com.example.diagram.web.dto.CatalogPart;
import com.example.diagram.web.dto.BoxSuggestionRequest;
import com.example.diagram.web.dto.BoxSuggestionResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Suggests the component a diagram box needs. The box's label/role/kind is turned
 * into a catalogue search term; the live Arrow catalogue is searched, results are
 * grouped per manufacturer part number, and each candidate is cross-checked
 * against Design Win POS so the parts most used in real designs (shipment
 * history) rank first. Suppliers offering each part are returned so the user can
 * pick one at BOM time.
 */
@Service
public class BoxSuggestionServiceImpl implements BoxSuggestionService {

    private static final Logger log = LoggerFactory.getLogger(BoxSuggestionServiceImpl.class);

    /** Box kind → a catalogue-friendly component category noun. */
    private static final Map<String, String> KIND_TERM = Map.ofEntries(
            Map.entry("mcu", "microcontroller"), Map.entry("processor", "microcontroller"),
            Map.entry("ai", "AI accelerator"), Map.entry("memory", "flash memory"),
            Map.entry("sensor", "sensor"), Map.entry("camera", "image sensor"),
            Map.entry("motor", "motor driver"), Map.entry("battery", "battery charger"),
            Map.entry("power", "power management IC"), Map.entry("dcdc", "buck regulator"),
            Map.entry("regulator", "LDO regulator"), Map.entry("comms", "transceiver"),
            Map.entry("wifi", "wifi module"), Map.entry("antenna", "antenna"),
            Map.entry("display", "display driver"), Map.entry("connector", "connector"),
            Map.entry("amplifier", "operational amplifier"), Map.entry("clock", "oscillator"),
            Map.entry("logic", "logic gate"), Map.entry("input", "analog switch"),
            Map.entry("output", "level shifter"));

    /** Label keyword → component term, for common labels the kind can't capture. */
    private static final Map<String, String> LABEL_TERM = Map.ofEntries(
            Map.entry("op-amp", "operational amplifier"), Map.entry("opamp", "operational amplifier"),
            Map.entry("can", "CAN transceiver"), Map.entry("uart", "UART transceiver"),
            Map.entry("can/uart", "CAN transceiver"), Map.entry("isolation", "digital isolator"),
            Map.entry("ldo", "LDO regulator"), Map.entry("dc/dc", "buck regulator"),
            Map.entry("supervisor", "voltage supervisor"), Map.entry("bjt", "bipolar transistor"),
            Map.entry("transducer", "sensor"), Map.entry("mcu", "microcontroller"),
            Map.entry("analog switch", "analog switch"));

    private final PartSearchService parts;
    private final DesignWinService designWin;
    private final ObjectMapper mapper;

    @Value("${recommendation.pos-check:true}")
    private boolean posCheck = true;

    public BoxSuggestionServiceImpl(PartSearchService parts, DesignWinService designWin, ObjectMapper mapper) {
        this.parts = parts;
        this.designWin = designWin;
        this.mapper = mapper;
    }

    @Override
    public BoxSuggestionResult suggest(BoxSuggestionRequest req) {
        String label = req.label(), sub = req.sub(), kind = req.kind();
        String query = queryFor(label, sub, kind);
        List<CatalogPart> found;
        try {
            found = parts.search(query, null, false, false, 0, 50).parts();
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Box suggestion search for '{}' failed: {}", query, ex.toString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach the catalogue to suggest a component.");
        }
        if (found.isEmpty()) {
            return new BoxSuggestionResult(query, List.of(),
                    "No catalogue matches for \"" + query + "\". Try renaming the box or searching parts directly.");
        }

        Set<String> approved = approvedMpns(req);

        // One CatalogPart per supplier offer; group them by MPN so a box gets one
        // suggestion per part with its alternative sources beneath.
        Map<String, List<CatalogPart>> byMpn = new LinkedHashMap<>();
        for (CatalogPart p : found) {
            String mpn = p.partNumber();
            if (!mpn.isBlank()) byMpn.computeIfAbsent(mpn, k -> new ArrayList<>()).add(p);
        }

        List<BoxSuggestion> suggestions = new ArrayList<>();
        for (Map.Entry<String, List<CatalogPart>> e : byMpn.entrySet()) {
            suggestions.add(toSuggestion(e.getKey(), e.getValue(), approved));
        }
        suggestions.sort((a, b) -> {
            int c = Boolean.compare(b.customerApproved(), a.customerApproved());
            if (c != 0) return c;
            int p = Boolean.compare(b.fieldProven(), a.fieldProven());
            if (p != 0) return p;
            return Long.compare(b.stock(), a.stock());
        });
        if (suggestions.size() > 6) suggestions = suggestions.subList(0, 6);

        String note = approved.isEmpty()
                ? "Grounded in the Arrow catalogue; field-proven items have Design Win POS shipment history."
                : "Grounded in the Arrow catalogue; parts this customer has already registered are marked "
                        + "customer-approved and ranked first, then field-proven (POS) parts.";
        return new BoxSuggestionResult(query, suggestions, note);
    }

    /**
     * The manufacturer part numbers the attached Design Win customer has registered
     * (their approved parts), lower-cased for matching. Empty when no customer is
     * attached or the lookup is unavailable.
     */
    private Set<String> approvedMpns(BoxSuggestionRequest req) {
        Set<String> out = new LinkedHashSet<>();
        if (req == null || (!present(req.customerName()) && !present(req.custBillTo()))) return out;
        try {
            String json = designWin.custPartSearch(req.customerName(), req.custBillTo(),
                    req.projectId(), req.boardNum(), null);
            collectPartNumbers(mapper.readTree(json == null ? "" : json), out);
        } catch (Exception ex) {
            log.debug("Customer approved-parts lookup failed for '{}': {}", req.customerName(), ex.toString());
        }
        return out;
    }

    private static final Set<String> PART_NUM_KEYS =
            Set.of("partnumber", "mfrpartnum", "custpartnum", "arwpartnum", "supppartnum");

    /** Deep-scans a Design Win response for any part-number field and collects them (lower-cased). */
    private static void collectPartNumbers(JsonNode node, Set<String> out) {
        if (node == null) return;
        if (node.isObject()) {
            node.fields().forEachRemaining(e -> {
                JsonNode v = e.getValue();
                if (PART_NUM_KEYS.contains(e.getKey().toLowerCase())) {
                    String pn = v.isTextual() ? v.asText() : (v.has("name") ? v.path("name").asText("") : "");
                    if (!pn.isBlank()) out.add(pn.trim().toLowerCase());
                } else {
                    collectPartNumbers(v, out);
                }
            });
        } else if (node.isArray()) {
            node.forEach(c -> collectPartNumbers(c, out));
        }
    }

    private BoxSuggestion toSuggestion(String mpn, List<CatalogPart> offers, Set<String> approved) {
        CatalogPart best = offers.get(0);
        String mfr = best.manufacturer().isBlank() ? best.supplier() : best.manufacturer();
        String desc = best.description().isBlank() ? best.category() : best.description();
        if (desc.isBlank()) desc = mpn;
        String category = String.join(" / ", best.categoryPath());
        if (category.isBlank()) category = best.category();
        boolean proven = fieldProven(mpn, mfr);
        boolean customerApproved = !approved.isEmpty() && approved.contains(mpn.trim().toLowerCase());

        List<BoxSuggestion.Supplier> suppliers = new ArrayList<>();
        long totalStock = 0;
        Set<String> seen = new LinkedHashSet<>();
        for (CatalogPart p : offers) {
            String sName = p.supplier().isBlank() ? p.manufacturer() : p.supplier();
            if (sName.isBlank()) sName = "Arrow";
            if (!seen.add(sName.toLowerCase())) continue;
            totalStock += p.stock().totalOnHand();
            suppliers.add(new BoxSuggestion.Supplier(sName,
                    p.supplierPartNumber().isBlank() ? p.partNumber() : p.supplierPartNumber(),
                    p.stock().totalOnHand(), p.leadTime().arrowWeeks(),
                    priceOf(p), p.packaging().minOrderQty()));
        }
        return new BoxSuggestion(mpn, mfr, desc, category, best.status(), totalStock,
                best.leadTime().arrowWeeks(), proven, customerApproved,
                priceOf(best), best.packaging().minOrderQty(), suppliers);
    }

    /** Unit price from the normalised pricing; 0 when the catalogue quotes none. */
    private static double priceOf(CatalogPart p) {
        try {
            return Double.parseDouble(p.pricing().unitPrice());
        } catch (RuntimeException ex) {
            return 0;
        }
    }

    /** True when Design Win POS reports shipment history for the part (field-proven / most used). */
    private boolean fieldProven(String mpn, String mfr) {
        if (!posCheck) return false;
        try {
            String json = designWin.sales(mpn, present(mfr) ? mfr : null);
            JsonNode root = mapper.readTree(json == null ? "" : json);
            for (String key : new String[]{"sales", "details", "pos", "salesData", "posData"}) {
                JsonNode a = root.path(key);
                if (a.isArray() && !a.isEmpty()) return true;
            }
            return root.path("posAmount").asDouble(0) > 0;
        } catch (Exception ex) {
            log.debug("POS check for '{}' failed: {}", mpn, ex.toString());
            return false;
        }
    }

    private String queryFor(String label, String sub, String kind) {
        String l = label == null ? "" : label.trim().toLowerCase();
        if (LABEL_TERM.containsKey(l)) return LABEL_TERM.get(l);
        String k = kind == null ? "" : kind.trim().toLowerCase();
        if (KIND_TERM.containsKey(k)) return KIND_TERM.get(k);
        if (present(label)) return label.trim();
        if (present(sub)) return sub.trim();
        return "component";
    }

    private static String mpnOf(JsonNode p) {
        String s = firstText(p.at("/suppPartNum/name"), p.at("/arwPartNum/name"), "");
        return s.trim();
    }

    private static long stockOf(JsonNode part) {
        JsonNode avail = part.at("/invOrgs/0/avail");
        return avail.at("/totohQty").asLong(avail.at("/FOHQty").asLong(avail.at("/ACFOHQty").asLong(0)));
    }

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }

    private static String firstText(JsonNode a, JsonNode b, String fallback) {
        if (a != null && a.isTextual() && !a.asText().isBlank()) return a.asText();
        if (b != null && b.isTextual() && !b.asText().isBlank()) return b.asText();
        return fallback;
    }
}
