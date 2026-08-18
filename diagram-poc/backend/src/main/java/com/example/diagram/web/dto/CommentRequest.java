package com.example.diagram.web.dto;

/** Inbound payload to add a comment (nodeId optional — null = general comment). */
public record CommentRequest(String nodeId, String text) {}
