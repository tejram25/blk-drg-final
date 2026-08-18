package com.example.diagram.service.impl;

import com.example.diagram.domain.Comment;
import com.example.diagram.repository.CommentRepository;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.web.dto.CommentRequest;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommentServiceImplTest {

    @Mock private CommentRepository comments;
    @Mock private DiagramRepository diagrams;
    @Mock private UserRepository users;
    @InjectMocks private CommentServiceImpl service;

    @Test
    void add_notFoundWhenDiagramMissing() {
        when(diagrams.existsById(9L)).thenReturn(false);
        assertThrows(NotFoundException.class,
                () -> service.add(9L, new CommentRequest("n1", "hi"), "a@x.com"));
    }

    @Test
    void add_rejectsEmptyText() {
        when(diagrams.existsById(1L)).thenReturn(true);
        assertThrows(IllegalArgumentException.class,
                () -> service.add(1L, new CommentRequest("n1", "   "), "a@x.com"));
        verify(comments, never()).save(any());
    }

    @Test
    void add_savesPinnedComment() {
        when(diagrams.existsById(1L)).thenReturn(true);
        when(users.findByEmail("a@x.com")).thenReturn(Optional.empty());
        when(comments.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));

        service.add(1L, new CommentRequest("node-7", "looks good"), "a@x.com");

        ArgumentCaptor<Comment> captor = ArgumentCaptor.forClass(Comment.class);
        verify(comments).save(captor.capture());
        Comment saved = captor.getValue();
        assertThat(saved.getDiagramId()).isEqualTo(1L);
        assertThat(saved.getNodeId()).isEqualTo("node-7");
        assertThat(saved.getText()).isEqualTo("looks good");
        assertThat(saved.getAuthorEmail()).isEqualTo("a@x.com");
    }

    @Test
    void delete_rejectsNonAuthor() {
        Comment c = new Comment();
        c.setAuthorEmail("owner@x.com");
        when(comments.findById(3L)).thenReturn(Optional.of(c));
        assertThrows(IllegalArgumentException.class, () -> service.delete(3L, "intruder@x.com"));
        verify(comments, never()).delete(any());
    }

    @Test
    void delete_allowsAuthor() {
        Comment c = new Comment();
        c.setAuthorEmail("a@x.com");
        when(comments.findById(3L)).thenReturn(Optional.of(c));
        service.delete(3L, "a@x.com");
        verify(comments).delete(c);
    }
}
