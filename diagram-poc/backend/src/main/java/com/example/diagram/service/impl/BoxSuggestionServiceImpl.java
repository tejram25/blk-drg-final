package com.example.diagram.service.impl;

import com.example.diagram.service.BoxSuggestionService;
import com.example.diagram.service.DesignWinService;
import com.example.diagram.service.PartSearchService;
import com.example.diagram.web.dto.BoxSuggestion;
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
import java.util.List;
import java.util.Map;

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
    public BoxSuggestionResult suggest(String label, String sub, String kind) {
        String query = queryFor(label, sub, kind);
        JsonNode arr;
        try {
            String json = parts.search(query, null, true);
            arr = mapper.readTree(json == null ? "" : json).at("/partserviceresult/parts");
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Box suggestion search for '{}' failed: {}", query, ex.toString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach the Arrow catalogue to suggest a component.");
        }
        if (!arr.isArray() || arr.isEmpty()) {
            return new BoxSuggestionResult(query, List.of(),
                    "No catalogue matches for \"" + query + "\". Try renaming the box or searching parts directly.");
        }

        // Group offers by manufacturer part number → one component with its suppliers.
        Map<String, List<JsonNode>> byMpn = new LinkedHashMap<>();
        for (JsonNode p : arr) {
            String mpn = mpnOf(p);
            if (!mpn.isBlank()) byMpn.computeIfAbsent(mpn, k -> new ArrayList<>()).add(p);
        }

        List<BoxSuggestion> suggestions = new ArrayList<>();
        for (Map.Entry<String, List<JsonNode>> e : byMpn.entrySet()) {
            suggestions.add(toSuggestion(e.getKey(), e.getValue()));
        }
        // Most field-proven, then most in-stock, then active status first.
        suggestions.sort((a, b) -> {
            int p = Boolean.compare(b.fieldProven(), a.fieldProven());
            if (p != 0) return p;
            return Long.compare(b.stock(), a.stock());
        });
        if (suggestions.size() > 6) suggestions = suggestions.subList(0, 6);

        String note = "Grounded in the Arrow catalogue; field-proven items have Design Win POS shipment history.";
        return new BoxSuggestionResult(query, suggestions, note);
    }

    private BoxSuggestion toSuggestion(String mpn, List<JsonNode> offers) {
        JsonNode best = offers.get(0);
        String mfr = firstText(best.at("/mfr/name"), best.at("/supp/name"), "");
        JsonNode org = best.at("/invOrgs/0");
        String desc = firstText(org.at("/desc"), best.at("/icc/name"), mpn);
        String category = firstText(best.at("/icc/tree"), best.at("/icc/name"), "");
        String status = org.at("/status").asText("");
        String lead = best.at("/leadTime/arwLT").asText("");
        boolean proven = fieldProven(mpn, mfr);

        List<BoxSuggestion.Supplier> suppliers = new ArrayList<>();
        long totalStock = 0;
        java.util.Set<String> seen = new java.util.LinkedHashSet<>();
        for (JsonNode p : offers) {
            String sName = firstText(p.at("/supp/name"), p.at("/mfr/name"), "Arrow");
            if (!seen.add(sName.toLowerCase())) continue;
            long s = stockOf(p);
            totalStock += s;
            suppliers.add(new BoxSuggestion.Supplier(sName,
                    firstText(p.at("/suppPartNum/name"), p.at("/arwPartNum/name"), mpn),
                    s, p.at("/leadTime/arwLT").asText(""), priceOf(p), moqOf(p)));
        }
        return new BoxSuggestion(mpn, mfr, desc, category, status, totalStock, lead, proven,
                priceOf(best), moqOf(best), suppliers);
    }

    /** Best-effort unit price from the Arrow part JSON (several shapes exist); 0 if none. */
    private static double priceOf(JsonNode p) {
        for (String path : new String[]{"/prices/0/price", "/pricing/0/price", "/resaleList/0/price",
                "/priceBreaks/0/price", "/price", "/prc"}) {
            JsonNode n = p.at(path);
            if (n.isNumber()) return n.asDouble();
            if (n.isTextual()) {
                try {
                    return Double.parseDouble(n.asText().replaceAll("[^0-9.]", ""));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return 0;
    }

    /** Best-effort minimum order quantity; 0 if none. */
    private static int moqOf(JsonNode p) {
        for (String path : new String[]{"/minOrderQty", "/moq", "/invOrgs/0/moq", "/orderMultiple", "/invOrgs/0/pkgQty"}) {
            JsonNode n = p.at(path);
            if (n.isNumber()) return n.asInt();
            if (n.isTextual()) {
                try {
                    return Integer.parseInt(n.asText().replaceAll("[^0-9]", ""));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return 0;
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
