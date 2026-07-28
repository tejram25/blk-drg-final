package com.example.diagram.web.dto;

/** One resale price break: {@code price} applies from minQty up to maxQty. */
public record PartPriceBreak(String price, String minQty, String maxQty) {}
