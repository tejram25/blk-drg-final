package com.example.diagram.web.dto;

import java.util.List;

/**
 * Regulatory and trade attributes — the things that disqualify a part late in a
 * design if nobody checked them early.
 *
 * @param standards       compliance schemes met, e.g. ["EU ROHS", "CHINA ROHS"]
 * @param svhc            true when the part is flagged against REACH SVHC
 * @param eccnUs          US export control classification
 * @param eccnWassenaar   Wassenaar classification
 * @param hts             harmonised tariff code
 * @param countryOfOrigin ISO country code the part ships from
 */
public record PartCompliance(
        List<String> standards,
        boolean svhc,
        String eccnUs,
        String eccnWassenaar,
        String hts,
        String countryOfOrigin) {}
