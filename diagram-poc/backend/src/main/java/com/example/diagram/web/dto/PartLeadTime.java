package com.example.diagram.web.dto;

/**
 * Lead times as the catalogue reports them (weeks, as strings — the upstream
 * sends "7", and blanks are meaningful).
 *
 * @param arrowWeeks    Arrow's own lead time
 * @param supplierWeeks the supplier's lead time
 * @param supplierDate  date the supplier lead time was quoted
 * @param supplierAvailable quantity the supplier holds — the answer to "Arrow has
 *                          none, when can I get it?", which on-hand alone cannot give
 * @param factoryStockDate  date the factory expects stock
 */
public record PartLeadTime(
        String arrowWeeks,
        String supplierWeeks,
        String supplierDate,
        long supplierAvailable,
        String factoryStockDate) {}
