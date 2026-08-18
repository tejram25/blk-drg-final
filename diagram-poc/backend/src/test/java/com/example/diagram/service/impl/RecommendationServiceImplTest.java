package com.example.diagram.service.impl;

import com.example.diagram.config.OllamaProperties;
import com.example.diagram.domain.Template;
import com.example.diagram.repository.TemplateRepository;
import com.example.diagram.service.DesignWinService;
import com.example.diagram.service.PartSearchNormalizer;
import com.example.diagram.service.PartSearchService;
import com.example.diagram.web.dto.PartSearchResponse;
import com.example.diagram.web.dto.RecommendationRequest;
import com.example.diagram.web.dto.RecommendationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendationServiceImplTest {

    @Mock private TemplateRepository templates;

    /**
     * Turn an upstream-shaped JSON fixture into the typed response the service
     * now returns. Fixtures stay in catalogue JSON because that is the shape
     * the real thing sends, and the normaliser is the code under test's own.
     */
    private static PartSearchResponse normalise(String upstreamJson, String query) {
        try {
            return new PartSearchNormalizer().normalize(new ObjectMapper().readTree(upstreamJson), query);
        } catch (Exception ex) {
            throw new IllegalStateException("bad fixture", ex);
        }
    }

    /** Part search that returns nothing, so the rule-based path is exercised in isolation. */
    private static final PartSearchService NO_PARTS = new PartSearchService() {
        @Override public PartSearchResponse search(String q, String manufacturer, boolean inStockOnly,
                                                            boolean activeOnly, int start, int limit) {
            return normalise("{\"partserviceresult\":{\"parts\":[]}}", q);
        }
        @Override public Map<String, Object> health() { return Map.of(); }
    };

    /** Design Win with no POS history. */
    private static final DesignWinService NO_SALES = designWin(false);

    private static DesignWinService designWin(boolean hasSales) {
        String sales = hasSales ? "{\"posAmount\":\"11272.8\"}" : "";
        return new DesignWinService() {
            @Override public String customers(String a, String b, String c) { return "{}"; }
            @Override public String projects(String a, String b, String c) { return "{}"; }
            @Override public String boards(String a, String b) { return "{}"; }
            @Override public String registrationDetails(String a, String b, String c, String d) { return "{}"; }
            @Override public String custPartSearch(String a, String b, String c, String d, String e) { return "{}"; }
            @Override public String sales(String partNumber, String mfrName) {
                return "{\"sales\":[" + sales + "],\"status\":\"S\"}";
            }
        };
    }

    private RecommendationServiceImpl service() {
        return service(NO_PARTS, NO_SALES);
    }

    private RecommendationServiceImpl service(PartSearchService parts) {
        return service(parts, NO_SALES);
    }

    private RecommendationServiceImpl service(PartSearchService parts, DesignWinService designWin) {
        OllamaProperties props = new OllamaProperties();
        props.setEnabled(false); // disabled → rule-based path
        Template t = new Template();
        t.setName("Smart Microgrid");
        t.setCategory("Power");
        t.setDescription("Inverter and battery power architecture");
        lenient().when(templates.findAll()).thenReturn(List.of(t));
        ObjectMapper mapper = new ObjectMapper();
        ComponentKeywordDictionary keywords = new ComponentKeywordDictionary(mapper);
        return new RecommendationServiceImpl(props, templates, parts, designWin, keywords, mapper);
    }

    @Test
    void ruleBased_suggestsTemplateAndPartsForPowerGoal() {
        RecommendationResult res = service().recommend(
                new RecommendationRequest("Design a power supply regulator", List.of()));

        assertThat(res.aiGenerated()).isFalse();
        assertThat(res.model()).isEqualTo("rule-based");
        assertThat(res.items()).isNotEmpty();
        assertThat(res.items()).anyMatch(i -> "part".equals(i.type()) && i.title().contains("LM317"));
        assertThat(res.items()).anyMatch(i -> "template".equals(i.type()) && i.title().equals("Smart Microgrid"));
        // every item carries a verify prompt
        assertThat(res.items()).allMatch(i -> i.verify() != null && !i.verify().isBlank());
    }

    @Test
    void ruleBased_alwaysIncludesABomSolutionNudge() {
        RecommendationResult res = service().recommend(
                new RecommendationRequest("", List.of()));
        assertThat(res.items()).anyMatch(i -> "solution".equals(i.type()));
    }

    @Test
    void groundsRecommendationsInLiveCatalogue() {
        // A catalogue that returns a real, in-stock part for any search.
        PartSearchService live = new PartSearchService() {
            @Override public PartSearchResponse search(String q, String manufacturer, boolean inStockOnly,
                                                                boolean activeOnly, int start, int limit) {
                return normalise("{\"partserviceresult\":{\"parts\":[{"
                        + "\"arwPartNum\":{\"name\":\"LM317T\"},"
                        + "\"mfr\":{\"name\":\"STMicroelectronics\"},"
                        + "\"leadTime\":{\"arwLT\":\"8\"},"
                        + "\"invOrgs\":[{\"status\":\"Active\",\"desc\":\"Adjustable regulator\","
                        + "\"avail\":{\"totohQty\":1200}}]}]}}", q);
            }
            @Override public Map<String, Object> health() { return Map.of(); }
        };

        RecommendationResult res = service(live).recommend(
                new RecommendationRequest("Design a power supply regulator", List.of()));

        assertThat(res.note()).contains("live Arrow catalogue");
        assertThat(res.items()).anyMatch(i ->
                "part".equals(i.type())
                        && i.title().equals("LM317T")
                        && i.source().contains("Arrow catalogue (live)")
                        && i.detail().contains("in stock"));
    }

    @Test
    void picksInStockActivePartOverDeadFirstResult() {
        // First result is dead (Nvr.Active, 0 stock); second is Active and in stock.
        PartSearchService live = new PartSearchService() {
            @Override public PartSearchResponse search(String q, String manufacturer, boolean inStockOnly,
                                                                boolean activeOnly, int start, int limit) {
                return normalise("{\"partserviceresult\":{\"parts\":["
                        // Distinct itemIds, as the real catalogue always sends: the
                        // normaliser groups by itemId, so two parts without one are a
                        // single part with merged locations.
                        + "{\"itemId\":\"1001\",\"arwPartNum\":{\"name\":\"DEADPART\"},"
                        + " \"invOrgs\":[{\"status\":\"Nvr.Active\",\"avail\":{\"totohQty\":0}}]},"
                        + "{\"itemId\":\"1002\",\"arwPartNum\":{\"name\":\"GOODPART\"},"
                        + " \"invOrgs\":[{\"status\":\"Active\",\"avail\":{\"totohQty\":500}}]}"
                        + "]}}", q);
            }
            @Override public Map<String, Object> health() { return Map.of(); }
        };

        RecommendationResult res = service(live).recommend(
                new RecommendationRequest("Design a power supply regulator", List.of()));

        assertThat(res.items()).anyMatch(i -> i.title().equals("GOODPART"));
        assertThat(res.items()).noneMatch(i -> i.title().equals("DEADPART"));
    }

    @Test
    void flagsFieldProvenPartsFromPos() {
        PartSearchService live = new PartSearchService() {
            @Override public PartSearchResponse search(String q, String manufacturer, boolean inStockOnly,
                                                                boolean activeOnly, int start, int limit) {
                return normalise("{\"partserviceresult\":{\"parts\":[{"
                        + "\"arwPartNum\":{\"name\":\"LM317T\"},"
                        + "\"mfr\":{\"name\":\"STMicroelectronics\"},"
                        + "\"invOrgs\":[{\"status\":\"Active\",\"avail\":{\"totohQty\":1200}}]}]}}", q);
            }
            @Override public Map<String, Object> health() { return Map.of(); }
        };

        RecommendationResult res = service(live, designWin(true)).recommend(
                new RecommendationRequest("Design a power supply regulator", List.of()));

        assertThat(res.items()).anyMatch(i ->
                i.title().equals("LM317T") && i.detail().contains("field-proven"));
    }
}
