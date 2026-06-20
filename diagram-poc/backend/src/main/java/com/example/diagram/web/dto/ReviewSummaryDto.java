package com.example.diagram.web.dto;

/** Per-diagram rating aggregate for the Open-list badges. */
public record ReviewSummaryDto(Long diagramId, double average, int count) {}
