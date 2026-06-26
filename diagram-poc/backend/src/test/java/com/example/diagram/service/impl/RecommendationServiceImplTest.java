package com.example.diagram.service.impl;

import com.example.diagram.config.GeminiProperties;
import com.example.diagram.domain.Template;
import com.example.diagram.repository.TemplateRepository;
import com.example.diagram.web.dto.RecommendationRequest;
import com.example.diagram.web.dto.RecommendationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendationServiceImplTest {

    @Mock private TemplateRepository templates;

    private RecommendationServiceImpl service() {
        GeminiProperties props = new GeminiProperties();
        props.setApiKey(""); // no key → rule-based path
        Template t = new Template();
        t.setName("Smart Microgrid");
        t.setCategory("Power");
        t.setDescription("Inverter and battery power architecture");
        lenient().when(templates.findAll()).thenReturn(List.of(t));
        return new RecommendationServiceImpl(props, templates, new ObjectMapper());
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
}
