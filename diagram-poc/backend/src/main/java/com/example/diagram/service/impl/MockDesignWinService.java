package com.example.diagram.service.impl;

import com.example.diagram.service.DesignWinService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.InputStream;

/**
 * Sample/offline implementation of the Arrow Design Win APIs. Active when
 * {@code arrow.mock=true} (mirroring {@link MockPartSearchService}), so the whole
 * customer → project → board → registration / customer-parts + POS flow can be
 * demoed without live Arrow credentials. Data comes from the bundled
 * {@code sample-designwin.json}; the same required-parameter validation as the
 * live service is kept so the frontend behaves identically.
 */
@Service
@ConditionalOnProperty(name = "arrow.mock", havingValue = "true")
public class MockDesignWinService implements DesignWinService {

    private static final Logger log = LoggerFactory.getLogger(MockDesignWinService.class);

    private final ObjectMapper objectMapper;
    private final JsonNode data;

    public MockDesignWinService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        try (InputStream in = getClass().getResourceAsStream("/sample-designwin.json")) {
            this.data = objectMapper.readTree(in);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not load sample-designwin.json", ex);
        }
    }

    @PostConstruct
    void announce() {
        log.info("Design Win: MOCK mode — serving bundled sample data (arrow.mock=true).");
    }

    @Override
    public String customers(String customerName, String billToNumber, String operatingUnit) {
        require(present(customerName) || present(billToNumber), "customerName or billToNumber is required.");
        // Filter the sample customers by the query; if nothing matches, echo the
        // query back as a single synthesised record so the drill-down still works.
        ObjectNode section = section("customers");
        ArrayNode all = firstArray(section);
        if (present(customerName) && all != null && !all.isEmpty()) {
            ArrayNode filtered = objectMapper.createArrayNode();
            for (JsonNode c : all) {
                if (c.path("customerName").asText("").toLowerCase().contains(customerName.toLowerCase())) {
                    filtered.add(c);
                }
            }
            if (filtered.isEmpty()) {
                ObjectNode synth = all.get(0).deepCopy();
                synth.put("customerName", customerName.trim());
                filtered.add(synth);
            }
            replaceArray(section, filtered);
        }
        return write(section);
    }

    @Override
    public String projects(String customerName, String projectName, String billToNumber) {
        require(present(customerName) || present(projectName) || present(billToNumber),
                "customerName, projectName or billToNumber is required.");
        ObjectNode section = section("projects");
        ArrayNode arr = firstArray(section);
        if (present(customerName) && arr != null) {
            for (JsonNode p : arr) {
                ((ObjectNode) p).put("customerName", customerName.trim());
            }
        }
        return write(section);
    }

    @Override
    public String boards(String projectId, String projectName) {
        require(present(projectId) || present(projectName), "projectId or projectName is required.");
        return write(section("boards"));
    }

    @Override
    public String registrationDetails(String arrowUniqueNum, String registrationNum,
                                      String boardNum, String trackingNum) {
        require(present(arrowUniqueNum) || present(registrationNum)
                        || present(boardNum) || present(trackingNum),
                "arrowUniqueNum, registrationNum, boardNum or trackingNum is required.");
        return write(section("registration"));
    }

    @Override
    public String custPartSearch(String customerName, String custBillTo,
                                 String projectId, String boardNum, String projectName) {
        require(present(customerName) || present(custBillTo), "customerName or custBillTo is required.");
        return write(section("custParts"));
    }

    @Override
    public String sales(String partNumber, String mfrName) {
        require(present(partNumber), "partNumber is required.");
        // Stamp the queried part (and mfr, if given) onto every POS row so the
        // "field-proven" result reflects what was asked for.
        ObjectNode section = section("sales");
        ArrayNode arr = firstArray(section);
        if (arr != null) {
            for (JsonNode row : arr) {
                ((ObjectNode) row).put("partNumber", partNumber.trim());
                if (present(mfrName)) ((ObjectNode) row).put("mfrName", mfrName.trim());
            }
        }
        return write(section);
    }

    // ---- helpers ----

    private ObjectNode section(String name) {
        return data.get(name).deepCopy();
    }

    /** The first non-empty array of objects anywhere in the section (matches the
     * frontend's tolerant parsing); null if there is none. */
    private ArrayNode firstArray(JsonNode node) {
        if (node.isArray()) {
            ArrayNode a = (ArrayNode) node;
            return (!a.isEmpty() && a.get(0).isObject()) ? a : null;
        }
        if (node.isObject()) {
            for (JsonNode child : node) {
                ArrayNode found = firstArray(child);
                if (found != null) return found;
            }
        }
        return null;
    }

    private void replaceArray(JsonNode section, ArrayNode replacement) {
        replaceArray(section, replacement, new boolean[]{false});
    }

    private void replaceArray(JsonNode node, ArrayNode replacement, boolean[] done) {
        if (done[0] || !(node instanceof ObjectNode obj)) return;
        for (java.util.Iterator<String> it = obj.fieldNames(); it.hasNext(); ) {
            String field = it.next();
            JsonNode child = obj.get(field);
            if (child.isArray()) { obj.set(field, replacement); done[0] = true; return; }
            replaceArray(child, replacement, done);
            if (done[0]) return;
        }
    }

    private String write(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }

    private static void require(boolean ok, String message) {
        if (!ok) throw new IllegalArgumentException(message);
    }
}
