package com.example.diagram.service;

import com.example.diagram.web.dto.FeedbackRequest;
import com.example.diagram.web.dto.FeedbackResponse;

import java.util.List;

/** Stores and lists user feedback ("feedback loop"). */
public interface FeedbackService {

    FeedbackResponse submit(FeedbackRequest request, String userEmail);

    List<FeedbackResponse> list();
}
