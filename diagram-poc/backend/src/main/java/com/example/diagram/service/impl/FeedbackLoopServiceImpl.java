package com.example.diagram.service.impl;

import com.example.diagram.domain.FeedbackEntry;
import com.example.diagram.domain.FeedbackThread;
import com.example.diagram.repository.DiagramRepository;
import com.example.diagram.repository.FeedbackEntryRepository;
import com.example.diagram.repository.FeedbackThreadRepository;
import com.example.diagram.repository.UserRepository;
import com.example.diagram.service.FeedbackLoopService;
import com.example.diagram.web.dto.FeedbackLoopDtos.BoardDto;
import com.example.diagram.web.dto.FeedbackLoopDtos.EntryDto;
import com.example.diagram.web.dto.FeedbackLoopDtos.NewEntryRequest;
import com.example.diagram.web.dto.FeedbackLoopDtos.NewThreadRequest;
import com.example.diagram.web.dto.FeedbackLoopDtos.ThreadDto;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FeedbackLoopServiceImpl implements FeedbackLoopService {

    private static final int MAX_TEXT = 2000;
    private static final int MAX_TITLE = 200;
    private static final int MAX_ROLE = 60;
    private static final Set<String> DECISIONS = Set.of(
            FeedbackEntry.COMMENT, FeedbackEntry.REQUEST_CHANGES, FeedbackEntry.APPROVE, FeedbackEntry.CLOSE);

    private final FeedbackThreadRepository threads;
    private final FeedbackEntryRepository entries;
    private final DiagramRepository diagrams;
    private final UserRepository users;

    public FeedbackLoopServiceImpl(FeedbackThreadRepository threads, FeedbackEntryRepository entries,
                                   DiagramRepository diagrams, UserRepository users) {
        this.threads = threads;
        this.entries = entries;
        this.diagrams = diagrams;
        this.users = users;
    }

    @Override
    public BoardDto board(Long diagramId, String userEmail) {
        List<FeedbackThread> list = threads.findByDiagramIdOrderByUpdatedAtDesc(diagramId);
        List<Long> ids = list.stream().map(FeedbackThread::getId).toList();
        Map<Long, List<FeedbackEntry>> byThread = ids.isEmpty() ? Map.of()
                : entries.findByThreadIdInOrderByCreatedAtAscIdAsc(ids).stream()
                        .collect(Collectors.groupingBy(FeedbackEntry::getThreadId));
        // Distinct roles already used on this diagram → suggestions in the UI.
        Set<String> roles = new LinkedHashSet<>();
        byThread.values().forEach(es -> es.forEach(e -> {
            if (e.getRole() != null && !e.getRole().isBlank()) roles.add(e.getRole());
        }));
        List<ThreadDto> dtos = new ArrayList<>();
        for (FeedbackThread t : list) {
            dtos.add(toDto(t, byThread.getOrDefault(t.getId(), List.of()), userEmail));
        }
        return new BoardDto(dtos, new ArrayList<>(roles));
    }

    @Override
    public ThreadDto createThread(Long diagramId, NewThreadRequest req, String userEmail) {
        if (!diagrams.existsById(diagramId)) throw new NotFoundException("Diagram not found");
        String title = clean(req.title(), MAX_TITLE);
        String text = clean(req.text(), MAX_TEXT);
        if (title.isEmpty() && text.isEmpty()) throw new IllegalArgumentException("Feedback cannot be empty");
        if (title.isEmpty()) title = text.length() > 80 ? text.substring(0, 77) + "…" : text;

        FeedbackThread t = new FeedbackThread();
        t.setDiagramId(diagramId);
        t.setTitle(title);
        t.setNodeId(req.nodeId());
        t.setStatus(FeedbackThread.OPEN);
        t.setCreatedByEmail(userEmail);
        t.setCreatedByName(displayName(userEmail));
        t = threads.save(t);

        FeedbackEntry first = newEntry(t.getId(), req.role(), FeedbackEntry.COMMENT, text, userEmail);
        return toDto(t, List.of(first), userEmail);
    }

    @Override
    public ThreadDto addEntry(Long threadId, NewEntryRequest req, String userEmail) {
        FeedbackThread t = threads.findById(threadId)
                .orElseThrow(() -> new NotFoundException("Feedback thread not found"));
        String decision = req.decision() == null || !DECISIONS.contains(req.decision())
                ? FeedbackEntry.COMMENT : req.decision();
        String text = clean(req.text(), MAX_TEXT);
        if (text.isEmpty() && FeedbackEntry.COMMENT.equals(decision)) {
            throw new IllegalArgumentException("Reply cannot be empty");
        }
        newEntry(threadId, req.role(), decision, text, userEmail);
        // The loop: each decision moves the thread's status.
        switch (decision) {
            case FeedbackEntry.REQUEST_CHANGES -> t.setStatus(FeedbackThread.CHANGES_REQUESTED);
            case FeedbackEntry.APPROVE -> t.setStatus(FeedbackThread.APPROVED);
            case FeedbackEntry.CLOSE -> t.setStatus(FeedbackThread.CLOSED);
            default -> {
                // a comment on a closed/approved thread reopens the conversation
                if (FeedbackThread.CLOSED.equals(t.getStatus())) t.setStatus(FeedbackThread.OPEN);
            }
        }
        t = threads.save(t);
        return toDto(t, entries.findByThreadIdOrderByCreatedAtAscIdAsc(threadId), userEmail);
    }

    private FeedbackEntry newEntry(Long threadId, String role, String decision, String text, String userEmail) {
        FeedbackEntry e = new FeedbackEntry();
        e.setThreadId(threadId);
        e.setRole(clean(role, MAX_ROLE));
        e.setDecision(decision);
        e.setText(text);
        e.setAuthorEmail(userEmail);
        e.setAuthorName(displayName(userEmail));
        return entries.save(e);
    }

    private ThreadDto toDto(FeedbackThread t, List<FeedbackEntry> es, String userEmail) {
        List<EntryDto> list = es.stream().map(e -> new EntryDto(
                e.getId(), e.getAuthorName(), e.getRole(), e.getDecision(), e.getText(), e.getCreatedAt(),
                userEmail != null && userEmail.equals(e.getAuthorEmail()))).toList();
        return new ThreadDto(t.getId(), t.getTitle(), t.getNodeId(), t.getStatus(),
                t.getCreatedByName(), t.getCreatedAt(), t.getUpdatedAt(), list);
    }

    private String displayName(String email) {
        if (email == null) return "Unknown";
        return users.findByEmail(email).map(u -> u.getName() == null || u.getName().isBlank() ? email : u.getName())
                .orElse(email);
    }

    private static String clean(String s, int max) {
        String v = s == null ? "" : s.trim();
        return v.length() > max ? v.substring(0, max) : v;
    }
}
