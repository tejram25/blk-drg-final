package com.example.diagram.service;

import com.example.diagram.web.dto.ReviewRequest;
import com.example.diagram.web.dto.ReviewResponse;
import com.example.diagram.web.dto.ReviewSummaryDto;

import java.util.List;

/** Review aggregation and submission. Reviewer identity is passed in by the web layer. */
public interface ReviewService {

    ReviewResponse getForDiagram(Long diagramId, String userEmail);

    ReviewResponse submit(Long diagramId, ReviewRequest request, String userEmail);

    List<ReviewSummaryDto> summary();
}
