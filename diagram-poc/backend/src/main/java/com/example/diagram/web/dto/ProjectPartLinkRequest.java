package com.example.diagram.web.dto;

/**
 * Link a catalogue part to a project (or update its quantity if already linked).
 *
 * @param partId      catalogue item id — the identity within the project
 * @param quantity    BOM quantity (min 1)
 * @param part        the full normalised CatalogPart as JSON, stored verbatim so
 *                    the card can be rebuilt without re-searching
 * @param partNumber  denormalised for listing/BOM without parsing {@code part}
 * @param manufacturer denormalised
 * @param description denormalised
 * @param status      denormalised
 * @param unitPrice   denormalised
 * @param currency    denormalised
 */
public record ProjectPartLinkRequest(
        String partId,
        int quantity,
        String part,
        String partNumber,
        String manufacturer,
        String description,
        String status,
        String unitPrice,
        String currency) {}
