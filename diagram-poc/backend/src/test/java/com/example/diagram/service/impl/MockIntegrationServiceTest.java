package com.example.diagram.service.impl;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MockIntegrationServiceTest {

    private final MockIntegrationService service = new MockIntegrationService();

    @Test
    void searchProjects_returnsAllWhenBlank() {
        assertThat(service.searchProjects("  ")).hasSizeGreaterThanOrEqualTo(3);
    }

    @Test
    void searchProjects_filtersByText() {
        var hits = service.searchProjects("microgrid");
        assertThat(hits).extracting(p -> p.name()).anyMatch(n -> n.toLowerCase().contains("microgrid"));
        assertThat(service.searchProjects("zzz-none")).isEmpty();
    }

    @Test
    void getProject_returnsDetailWithParts() {
        var p = service.getProject("OPP-10241");
        assertThat(p).isPresent();
        assertThat(p.get().parts()).isNotEmpty();
        assertThat(service.getProject("missing")).isEmpty();
    }
}
