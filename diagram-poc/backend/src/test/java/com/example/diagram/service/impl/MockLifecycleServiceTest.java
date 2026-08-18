package com.example.diagram.service.impl;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MockLifecycleServiceTest {

    private final MockLifecycleService service = new MockLifecycleService();

    @Test
    void knownNrndPart_returnsRiskAndAlternatives() {
        var info = service.lookup("DS91C176TMA/NOPB");
        assertThat(info.status()).isEqualTo("NRND");
        assertThat(info.alternatives()).isNotEmpty();
        assertThat(info.alternatives()).anyMatch(a -> a.dropIn());
    }

    @Test
    void unknownPart_defaultsToActive() {
        var info = service.lookup("WIDGET-123");
        assertThat(info.status()).isEqualTo("Active");
        assertThat(info.alternatives()).isEmpty();
    }
}
