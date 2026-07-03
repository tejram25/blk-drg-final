package com.example.diagram.web.dto;

import java.util.List;

/**
 * A suggested electronic component for a box, grounded in the Arrow catalogue and
 * cross-checked against Design Win POS ({@code fieldProven} = has shipment
 * history). {@code suppliers} are the offers for this part the user can choose
 * from when exporting a BOM.
 */
public record BoxSuggestion(
        String partNumber,
        String manufacturer,
        String description,
        String category,
        String status,
        long stock,
        String leadWeeks,
        boolean fieldProven,
        double unitPrice,
        int moq,
        List<Supplier> suppliers) {

    /** One offer for the part (a distributor/supplier). */
    public record Supplier(String name, String partNumber, long stock, String leadWeeks,
                           double unitPrice, int moq) {
    }
}
