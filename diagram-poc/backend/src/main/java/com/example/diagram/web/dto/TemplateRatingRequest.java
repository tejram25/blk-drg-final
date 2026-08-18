package com.example.diagram.web.dto;

/** Inbound payload for rating a template (1-5 stars). */
public record TemplateRatingRequest(Integer rating) {}
