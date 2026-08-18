package com.example.diagram.service.impl;

import com.example.diagram.config.OllamaProperties;
import com.example.diagram.web.dto.DesignReviewRequest;
import com.example.diagram.web.dto.DesignReviewRequest.Block;
import com.example.diagram.web.dto.DesignReviewRequest.Link;
import com.example.diagram.web.dto.DesignReviewResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DesignReviewServiceImplTest {

    private DesignReviewServiceImpl service() {
        OllamaProperties props = new OllamaProperties();
        props.setEnabled(false); // heuristics-only path
        return new DesignReviewServiceImpl(props, new ObjectMapper());
    }

    @Test
    void flagsMissingPowerAndDecoupling() {
        DesignReviewResult res = service().review(new DesignReviewRequest(
                "robot controller",
                List.of(new Block("Main Processor", "block"), new Block("Sensors", "block")),
                List.of(new Link("Sensors", "Main Processor"))));

        assertThat(res.aiGenerated()).isFalse();
        assertThat(res.findings()).anyMatch(f -> f.title().contains("power"));
        assertThat(res.findings()).anyMatch(f -> f.category().equals("Power integrity"));
    }

    @Test
    void flagsMotorWithoutDriver() {
        DesignReviewResult res = service().review(new DesignReviewRequest(
                "",
                List.of(new Block("BLDC Motor", null), new Block("Power Supply", null),
                        new Block("MCU", null)),
                List.of(new Link("MCU", "BLDC Motor"))));

        assertThat(res.findings()).anyMatch(f -> f.title().toLowerCase().contains("motor without a driver"));
    }

    @Test
    void flagsUnconnectedBlock() {
        DesignReviewResult res = service().review(new DesignReviewRequest(
                "",
                List.of(new Block("Power Supply", null), new Block("MCU", null),
                        new Block("Orphan", null)),
                List.of(new Link("Power Supply", "MCU"))));

        assertThat(res.findings()).anyMatch(f -> f.title().contains("Unconnected block: Orphan"));
    }

    @Test
    void severityRisksSortFirst() {
        DesignReviewResult res = service().review(new DesignReviewRequest(
                "",
                List.of(new Block("USB Port", null), new Block("MCU", null)),
                List.of()));
        // First finding should be the highest severity present.
        assertThat(res.findings()).isNotEmpty();
        assertThat(res.findings().get(0).severity()).isEqualTo("risk");
    }
}
