package com.example.diagram.service;

import com.example.diagram.web.dto.FeedbackLoopDtos.BoardDto;
import com.example.diagram.web.dto.FeedbackLoopDtos.NewEntryRequest;
import com.example.diagram.web.dto.FeedbackLoopDtos.NewThreadRequest;
import com.example.diagram.web.dto.FeedbackLoopDtos.ThreadDto;

/**
 * The feedback loop between the people working a diagram (sales, engineering,
 * customer, … — free-form roles, not a fixed set of actors): threads of
 * entries whose decisions drive the thread status.
 */
public interface FeedbackLoopService {

    BoardDto board(Long diagramId, String userEmail);

    ThreadDto createThread(Long diagramId, NewThreadRequest req, String userEmail);

    ThreadDto addEntry(Long threadId, NewEntryRequest req, String userEmail);
}
