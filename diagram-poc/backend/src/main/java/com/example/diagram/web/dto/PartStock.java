package com.example.diagram.web.dto;

/**
 * Availability rolled up across every inventory organisation holding the part.
 *
 * @param totalOnHand      sum of on-hand quantity across locations
 * @param nextQty          quantity on the soonest incoming delivery
 * @param nextDelivery     date of the soonest incoming delivery
 * @param locationCount    how many locations carry the part
 * @param inStockLocations how many of those currently have stock
 */
public record PartStock(
        long totalOnHand,
        long nextQty,
        String nextDelivery,
        int locationCount,
        int inStockLocations) {}
