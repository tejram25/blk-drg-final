package com.example.diagram.web.dto;

/**
 * How the part is supplied and ordered.
 *
 * @param packageType  e.g. "TAPE/REEL"
 * @param packageQty   units per package
 * @param minOrderQty  minimum order quantity
 * @param multipleQty  order multiple
 * @param uom          unit of measure, e.g. "EACH"
 */
public record PartPackaging(
        String packageType, String packageQty, int minOrderQty, int multipleQty, String uom) {}
