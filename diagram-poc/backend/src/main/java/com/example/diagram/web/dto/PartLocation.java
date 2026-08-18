package com.example.diagram.web.dto;

/**
 * One inventory organisation holding the part — the rows the upstream service
 * returns separately and this API folds into {@link CatalogPart#locations()}.
 *
 * @param id                organisation id
 * @param code              organisation code, e.g. "E21"
 * @param type              organisation type, e.g. PDC / BRK / VAT / PIVO
 * @param operatingUnit     owning operating unit
 * @param description       human-readable site, e.g. "EU-PDC-BTR-Euro-Venlo NL"
 * @param status            lifecycle status at this location
 * @param onHand            on-hand quantity here
 * @param nextQty           quantity on the next delivery here
 * @param nextDelivery      date of the next delivery here
 * @param minOrderQty       minimum order quantity here
 * @param preferred         whether this is a preferred location
 * @param designWinEligible whether design-win registration applies here
 */
public record PartLocation(
        String id,
        String code,
        String type,
        String operatingUnit,
        String description,
        String status,
        long onHand,
        long nextQty,
        String nextDelivery,
        int minOrderQty,
        boolean preferred,
        boolean designWinEligible) {}
