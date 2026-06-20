package com.example.diagram.web.dto;

/** Inbound payload to capture a snapshot of the current canvas. */
public record VersionRequest(String label, String contentJson) {}
