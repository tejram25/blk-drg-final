package com.example.diagram.service.impl;

import com.example.diagram.domain.DiagramVersion;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.DiagramVersionRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.web.dto.VersionRequest;
import com.example.diagram.web.dto.VersionSummary;
import com.example.diagram.web.error.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VersionServiceImplTest {

    @Mock private DiagramVersionRepository versions;
    @Mock private DiagramRepository diagrams;
    @Mock private UserRepository users;
    @InjectMocks private VersionServiceImpl service;

    @Test
    void snapshot_notFoundWhenDiagramMissing() {
        when(diagrams.existsById(9L)).thenReturn(false);
        assertThrows(NotFoundException.class,
                () -> service.snapshot(9L, new VersionRequest("v1", "{}"), "a@x.com"));
    }

    @Test
    void snapshot_savesWithLabelAuthorAndContent() {
        when(diagrams.existsById(1L)).thenReturn(true);
        when(users.findByEmail("a@x.com")).thenReturn(Optional.empty());
        when(versions.save(any(DiagramVersion.class))).thenAnswer(inv -> {
            DiagramVersion v = inv.getArgument(0);
            v.setId(5L);
            return v;
        });

        VersionSummary summary = service.snapshot(1L, new VersionRequest("Before refactor", "{\"cells\":[]}"), "a@x.com");

        ArgumentCaptor<DiagramVersion> captor = ArgumentCaptor.forClass(DiagramVersion.class);
        verify(versions).save(captor.capture());
        DiagramVersion saved = captor.getValue();
        assertThat(saved.getDiagramId()).isEqualTo(1L);
        assertThat(saved.getLabel()).isEqualTo("Before refactor");
        assertThat(saved.getContentJson()).isEqualTo("{\"cells\":[]}");
        assertThat(saved.getAuthorEmail()).isEqualTo("a@x.com");
        assertThat(summary.id()).isEqualTo(5L);
    }

    @Test
    void snapshot_defaultsBlankLabel() {
        when(diagrams.existsById(1L)).thenReturn(true);
        when(users.findByEmail("a@x.com")).thenReturn(Optional.empty());
        when(versions.save(any(DiagramVersion.class))).thenAnswer(inv -> inv.getArgument(0));

        service.snapshot(1L, new VersionRequest("  ", "{}"), "a@x.com");

        ArgumentCaptor<DiagramVersion> captor = ArgumentCaptor.forClass(DiagramVersion.class);
        verify(versions).save(captor.capture());
        assertThat(captor.getValue().getLabel()).isEqualTo("Snapshot");
    }

    @Test
    void get_notFoundWhenMissing() {
        when(versions.findById(7L)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.get(7L));
    }
}
