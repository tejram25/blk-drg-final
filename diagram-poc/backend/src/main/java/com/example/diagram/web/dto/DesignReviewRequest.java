package com.example.diagram.web.dto;

import java.util.List;

/**
 * The diagram structure submitted for an AI design review: the functional blocks
 * and the connections between them (by block name).
 */
public record DesignReviewRequest(String goal, List<Block> blocks, List<Link> links) {

    /** One functional block: its label and (optional) type/category. */
    public record Block(String name, String type) {}

    /** A connection from one block to another (by name). */
    public record Link(String from, String to) {}
}
