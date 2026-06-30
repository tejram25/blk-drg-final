package com.example.diagram.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ComponentKeywordDictionaryTest {

    private final ComponentKeywordDictionary dict = new ComponentKeywordDictionary(new ObjectMapper());

    @Test
    void mapsRoboticsGoalToComponentTerms() {
        // "amr"/"robot" drive the motion + IMU rules; "fast" is intentionally NOT a
        // microcontroller trigger (it was a dubious over-firing case before).
        assertThat(dict.termsFor("amr-robot-fast"))
                .contains("motor driver", "brushless motor controller", "IMU sensor");
    }

    @Test
    void stemTriggerMatchesWordVariants() {
        // "regulat" should match "regulator" (and "regulators").
        assertThat(dict.termsFor("Design a power supply regulator"))
                .contains("voltage regulator");
    }

    @Test
    void shortTriggerMatchesWholeWordNotSubstring() {
        // "led" matches the word "LED" but must NOT match "ledger".
        assertThat(dict.termsFor("LED blinker")).contains("LED driver");
        assertThat(dict.termsFor("accounting ledger system")).doesNotContain("LED driver");
    }

    @Test
    void emptyGoalYieldsNoTerms() {
        assertThat(dict.termsFor("")).isEmpty();
        assertThat(dict.termsFor(null)).isEmpty();
    }
}
