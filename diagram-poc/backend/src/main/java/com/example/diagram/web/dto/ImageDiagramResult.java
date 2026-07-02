package com.example.diagram.web.dto;

import java.util.List;

/**
 * A block diagram extracted from an image: the detected blocks and the
 * connections between them, plus the model that produced it. The frontend maps
 * each node's {@code kind} to one of the real palette components.
 */
public record ImageDiagramResult(
        String title,
        List<Node> nodes,
        List<Link> links,
        String model,
        String note) {

    /** A detected block. {@code x}/{@code y} are the block centre in a 0-1000 × 0-700 grid. */
    public record Node(String id, String label, String kind, int x, int y) {
    }

    /** A directed connection between two node ids. */
    public record Link(String from, String to, String label) {
    }
}
