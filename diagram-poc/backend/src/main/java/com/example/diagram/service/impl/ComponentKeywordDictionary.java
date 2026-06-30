package com.example.diagram.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Data-driven mapping from design-goal keywords to component catalogue search
 * terms. Rules are loaded from {@code /component-keywords.json} on startup, so
 * the mapping can be edited without touching code.
 *
 * <p>Matching is token-aware: the goal is split into words, and a trigger fires
 * when it equals a word exactly, or (for triggers of 5+ chars) is a prefix of a
 * word — so "regulat" matches "regulator"/"regulators" without "led" matching
 * "ledger". This is more precise than a raw substring scan of the whole goal.
 */
@Component
public class ComponentKeywordDictionary {

    private static final Logger log = LoggerFactory.getLogger(ComponentKeywordDictionary.class);

    private record Rule(List<String> terms, List<String> triggers) {}

    private final List<Rule> rules = new ArrayList<>();

    public ComponentKeywordDictionary(ObjectMapper mapper) {
        try (InputStream in = getClass().getResourceAsStream("/component-keywords.json")) {
            if (in == null) {
                throw new IllegalStateException("component-keywords.json not found on classpath");
            }
            JsonNode root = mapper.readTree(in);
            for (JsonNode r : root.path("rules")) {
                List<String> terms = toList(r.path("terms"));
                List<String> triggers = toList(r.path("triggers"));
                if (!terms.isEmpty() && !triggers.isEmpty()) {
                    rules.add(new Rule(terms, triggers));
                }
            }
            log.info("Loaded {} component-keyword rule(s).", rules.size());
        } catch (Exception ex) {
            log.error("Could not load component-keywords.json ({}); keyword term mapping is empty.",
                    ex.toString());
        }
    }

    /** Catalogue search terms implied by the goal, in rule order, de-duplicated. */
    public List<String> termsFor(String goal) {
        if (goal == null || goal.isBlank()) return List.of();
        Set<String> tokens = tokenize(goal.toLowerCase());
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (Rule r : rules) {
            for (String trigger : r.triggers()) {
                if (matches(tokens, trigger.toLowerCase())) {
                    out.addAll(r.terms());
                    break;
                }
            }
        }
        return new ArrayList<>(out);
    }

    private static boolean matches(Set<String> tokens, String trigger) {
        for (String tok : tokens) {
            if (tok.equals(trigger)) return true;
            if (trigger.length() >= 5 && tok.startsWith(trigger)) return true; // stem, e.g. regulat→regulator
        }
        return false;
    }

    private static Set<String> tokenize(String s) {
        Set<String> out = new LinkedHashSet<>();
        for (String tok : s.split("[^a-z0-9]+")) {
            if (!tok.isBlank()) out.add(tok);
        }
        return out;
    }

    private static List<String> toList(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr.isArray()) {
            for (JsonNode n : arr) {
                String v = n.asText("").trim();
                if (!v.isBlank()) out.add(v);
            }
        }
        return out;
    }
}
