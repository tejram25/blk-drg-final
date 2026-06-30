package com.example.diagram.service.impl;

import com.example.diagram.config.OllamaProperties;
import com.example.diagram.domain.Template;
import com.example.diagram.repository.TemplateRepository;
import com.example.diagram.service.PartSearchService;
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

    /** Part search that returns nothing, so the rule-based path is exercised in isolation. */
    private static final PartSearchService NO_PARTS = new PartSearchService() {
        @Override public String search(String q, String supplier, boolean dw) {
            return "{\"partserviceresult\":{\"parts\":[]}}";
        }
        @Override public Map<String, Object> health() { return Map.of(); }
    };

    private RecommendationServiceImpl service() {
        return service(NO_PARTS);
    }

    private RecommendationServiceImpl service(PartSearchService parts) {
        OllamaProperties props = new OllamaProperties();
        props.setEnabled(false); // disabled → rule-based path
        Template t = new Template();
        t.setName("Smart Microgrid");
        t.setCategory("Power");
        t.setDescription("Inverter and battery power architecture");
        lenient().when(templates.findAll()).thenReturn(List.of(t));
        return new RecommendationServiceImpl(props, templates, parts, new ObjectMapper());
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
            @Override public String search(String q, String supplier, boolean dw) {
                return "{\"partserviceresult\":{\"parts\":[{"
                        + "\"arwPartNum\":{\"name\":\"LM317T\"},"
                        + "\"mfr\":{\"name\":\"STMicroelectronics\"},"
                        + "\"leadTime\":{\"arwLT\":\"8\"},"
                        + "\"invOrgs\":[{\"status\":\"Active\",\"desc\":\"Adjustable regulator\","
                        + "\"avail\":{\"totohQty\":1200}}]}]}}";
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
}
