package com.example.diagram.web.dto;

/** Inbound payload for submitting/updating a review. */
public record ReviewRequest(Integer rating, String comment) {}
