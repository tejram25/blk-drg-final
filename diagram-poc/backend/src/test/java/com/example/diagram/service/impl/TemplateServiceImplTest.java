package com.example.diagram.service.impl;

import com.example.diagram.domain.Template;
import com.example.diagram.domain.User;
import com.example.diagram.repository.TemplateRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.web.dto.TemplateDetail;
import com.example.diagram.web.dto.TemplateRequest;
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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplateServiceImplTest {

    @Mock private TemplateRepository repository;
    @Mock private UserRepository users;
    @InjectMocks private TemplateServiceImpl service;

    private static final String JSON = "{\"cells\":[]}";

    @Test
    void get_throwsNotFoundWhenMissing() {
        when(repository.findById(9L)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.get(9L));
    }

    @Test
    void create_resolvesAuthorNameFromEmailAndSaves() {
        User author = new User();
        author.setEmail("ada@example.com");
        author.setName("Ada Lovelace");
        when(users.findByEmail("ada@example.com")).thenReturn(Optional.of(author));
        when(repository.save(any(Template.class))).thenAnswer(inv -> {
            Template t = inv.getArgument(0);
            t.setId(1L);
            return t;
        });

        TemplateDetail res = service.create(
                new TemplateRequest("My Template", " a desc ", " Robotics ", JSON), "ada@example.com");

        assertThat(res.id()).isEqualTo(1L);
        assertThat(res.name()).isEqualTo("My Template");
        assertThat(res.description()).isEqualTo("a desc");   // trimmed
        assertThat(res.category()).isEqualTo("Robotics");    // trimmed
        assertThat(res.authorName()).isEqualTo("Ada Lovelace");
        assertThat(res.usageCount()).isZero();
    }

    @Test
    void create_fallsBackToEmailWhenNoDisplayName() {
        when(users.findByEmail("anon@example.com")).thenReturn(Optional.empty());
        when(repository.save(any(Template.class))).thenAnswer(inv -> inv.getArgument(0));

        TemplateDetail res = service.create(
                new TemplateRequest("T", null, null, JSON), "anon@example.com");

        assertThat(res.authorName()).isEqualTo("anon@example.com");
        assertThat(res.description()).isNull();
        assertThat(res.category()).isNull();
    }

    @Test
    void create_rejectsBlankName() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create(new TemplateRequest("  ", null, null, JSON), "a@b.c"));
    }

    @Test
    void create_rejectsBlankContent() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create(new TemplateRequest("Name", null, null, "  "), "a@b.c"));
    }

    @Test
    void use_incrementsUsageCount() {
        Template existing = new Template();
        existing.setId(4L);
        existing.setName("Starter");
        existing.setContentJson(JSON);
        existing.setUsageCount(2);
        when(repository.findById(4L)).thenReturn(Optional.of(existing));
        when(repository.save(any(Template.class))).thenAnswer(inv -> inv.getArgument(0));

        TemplateDetail res = service.use(4L);

        assertThat(res.usageCount()).isEqualTo(3);
        assertThat(res.contentJson()).isEqualTo(JSON);
    }

    @Test
    void update_appliesChangesAndRecordsEditor() {
        Template existing = new Template();
        existing.setId(5L);
        existing.setName("Old");
        existing.setUsageCount(7);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));
        User editor = new User();
        editor.setEmail("grace@example.com");
        editor.setName("Grace Hopper");
        when(users.findByEmail("grace@example.com")).thenReturn(Optional.of(editor));
        when(repository.save(any(Template.class))).thenAnswer(inv -> inv.getArgument(0));

        TemplateDetail res = service.update(5L,
                new TemplateRequest("New name", "improved", "Power", JSON), "grace@example.com");

        assertThat(res.name()).isEqualTo("New name");
        assertThat(res.updatedByName()).isEqualTo("Grace Hopper");
        assertThat(res.usageCount()).isEqualTo(7); // usage preserved across an edit
    }

    @Test
    void delete_delegatesToRepository() {
        lenient().when(repository.findById(any())).thenReturn(Optional.empty());
        service.delete(3L);
        verify(repository).deleteById(3L);
    }
}
