package com.example.diagram.web.dto;

/** Create/update payload for a template (the author/editor comes from the session). */
public record TemplateRequest(String name, String description, String category, String contentJson) {}
