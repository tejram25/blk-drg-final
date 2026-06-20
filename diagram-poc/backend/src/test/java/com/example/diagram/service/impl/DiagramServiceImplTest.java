package com.example.diagram.service.impl;

import com.example.diagram.domain.Diagram;
import com.example.diagram.repository.DiagramRepository;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DiagramServiceImplTest {

    @Mock private DiagramRepository repository;
    @InjectMocks private DiagramServiceImpl service;

    @Test
    void get_throwsNotFoundWhenMissing() {
        when(repository.findById(5L)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.get(5L));
    }

    @Test
    void create_savesAndMapsToResponse() {
        Diagram saved = new Diagram();
        saved.setId(7L);
        saved.setName("Untitled");
        saved.setContentJson("{\"cells\":[]}");
        when(repository.save(any(Diagram.class))).thenReturn(saved);

        DiagramResponse res = service.create(new DiagramRequest("Untitled", "{\"cells\":[]}"));

        assertThat(res.id()).isEqualTo(7L);
        assertThat(res.name()).isEqualTo("Untitled");
        assertThat(res.contentJson()).isEqualTo("{\"cells\":[]}");
    }
}
