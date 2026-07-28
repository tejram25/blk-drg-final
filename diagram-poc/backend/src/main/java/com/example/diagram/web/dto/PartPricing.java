package com.example.diagram.web.dto;

import java.util.List;

/**
 * Resale pricing, taken from the best-ranked location that quotes it (not every
 * organisation does).
 *
 * @param currency  currency of the price breaks
 * @param breaks    quantity price breaks, cheapest tier last
 * @param unitPrice the single-unit price, i.e. the first break
 */
public record PartPricing(String currency, List<PartPriceBreak> breaks, String unitPrice) {}
