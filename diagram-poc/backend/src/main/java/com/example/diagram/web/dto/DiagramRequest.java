package com.example.diagram.web.dto;

/** Inbound payload for creating/updating a diagram. */
public record DiagramRequest(String name, String contentJson) {}
