package com.example.diagram.service.impl;

import com.example.diagram.domain.Diagram;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.service.AuditService;
import com.example.diagram.web.dto.DiagramRequest;
import com.example.diagram.web.dto.DiagramResponse;
import com.example.diagram.web.error.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DiagramServiceImplTest {

    @Mock private DiagramRepository repository;
    @Mock private AuditService audit;
    @InjectMocks private DiagramServiceImpl service;

    @Test
    void get_throwsNotFoundWhenMissing() {
        when(repository.findById(5L)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.get(5L, "user@acme.com"));
    }

    @Test
    void create_savesAndMapsToResponseAndAudits() {
        Diagram saved = new Diagram();
        saved.setId(7L);
        saved.setName("Untitled");
        saved.setContentJson("{\"cells\":[]}");
        saved.setClassification("INTERNAL");
        saved.setOwnerEmail("owner@acme.com");
        when(repository.save(any(Diagram.class))).thenReturn(saved);

        DiagramResponse res = service.create(
                new DiagramRequest("Untitled", "{\"cells\":[]}", "INTERNAL"), "owner@acme.com");

        assertThat(res.id()).isEqualTo(7L);
        assertThat(res.name()).isEqualTo("Untitled");
        assertThat(res.classification()).isEqualTo("INTERNAL");
        verify(audit).record(anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void get_restrictedHiddenFromNonOwner() {
        Diagram restricted = new Diagram();
        restricted.setId(9L);
        restricted.setClassification("RESTRICTED");
        restricted.setOwnerEmail("owner@acme.com");
        when(repository.findById(9L)).thenReturn(Optional.of(restricted));

        // A non-owner cannot tell the file exists.
        assertThrows(NotFoundException.class, () -> service.get(9L, "intruder@acme.com"));
        verify(audit, never()).record(anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void get_restrictedVisibleToOwner() {
        Diagram restricted = new Diagram();
        restricted.setId(9L);
        restricted.setName("Missile guidance");
        restricted.setClassification("RESTRICTED");
        restricted.setOwnerEmail("owner@acme.com");
        when(repository.findById(9L)).thenReturn(Optional.of(restricted));

        DiagramResponse res = service.get(9L, "owner@acme.com");

        assertThat(res.name()).isEqualTo("Missile guidance");
        verify(audit).record(anyString(), anyString(), anyLong(), anyString());
    }
}
