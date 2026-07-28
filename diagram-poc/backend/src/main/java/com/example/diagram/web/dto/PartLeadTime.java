package com.example.diagram.web.dto;

/**
 * Lead times as the catalogue reports them (weeks, as strings — the upstream
 * sends "7", and blanks are meaningful).
 *
 * @param arrowWeeks    Arrow's own lead time
 * @param supplierWeeks the supplier's lead time
 * @param supplierDate  date the supplier lead time was quoted
 */
public record PartLeadTime(String arrowWeeks, String supplierWeeks, String supplierDate) {}
