package com.example.diagram.service.impl;

import com.example.diagram.service.PartSearchService;
import com.fasterxml.jackson.core.JsonProcessingException;
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
 * Sample/offline implementation of part search. Active when {@code arrow.mock=true},
 * so the search → part card → BOM flow can be exercised without the live Arrow API.
 * Filters a small bundled catalogue (sample-parts.json) by the query.
 */
@Service
@ConditionalOnProperty(name = "arrow.mock", havingValue = "true")
public class MockPartSearchService implements PartSearchService {

    private static final Logger log = LoggerFactory.getLogger(MockPartSearchService.class);

    private final ObjectMapper objectMapper;
    private final JsonNode catalogue;

    public MockPartSearchService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        try (InputStream in = getClass().getResourceAsStream("/sample-parts.json")) {
            this.catalogue = objectMapper.readTree(in);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not load sample-parts.json", ex);
        }
    }

    @PostConstruct
    void announce() {
        log.info("Parts search: MOCK mode — serving the bundled sample catalogue (arrow.mock=true).");
    }

    @Override
    public String search(String query, String supplier, boolean designWin) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search text is required.");
        }
        String q = query.toLowerCase();
        ArrayNode matched = objectMapper.createArrayNode();
        for (JsonNode part : catalogue.path("partserviceresult").path("parts")) {
            if (matches(part, q, supplier)) {
                matched.add(part);
            }
        }
        ObjectNode root = catalogue.deepCopy();
        ObjectNode psr = (ObjectNode) root.get("partserviceresult");
        psr.set("parts", matched);
        psr.put("numItems", matched.size());
        psr.put("totalItems", matched.size());
        try {
            return objectMapper.writeValueAsString(root);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private boolean matches(JsonNode part, String q, String supplier) {
        String haystack = (part.at("/arwPartNum/name").asText("") + " "
                + part.at("/suppPartNum/name").asText("") + " "
                + part.at("/invOrgs/0/desc").asText("") + " "
                + typeParam(part)).toLowerCase();
        if (!haystack.contains(q)) {
            return false;
        }
        if (supplier != null && !supplier.isBlank()) {
            String supp = (part.at("/supp/name").asText("") + " " + part.at("/mfr/name").asText("")).toLowerCase();
            return supp.contains(supplier.toLowerCase());
        }
        return true;
    }

    private String typeParam(JsonNode part) {
        for (JsonNode pd : part.path("paramData")) {
            if ("Type".equals(pd.path("name").asText())) {
                return pd.path("val").asText("");
            }
        }
        return "";
    }
}
