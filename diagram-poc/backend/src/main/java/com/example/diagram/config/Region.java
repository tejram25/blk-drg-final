package com.example.diagram.config;

import java.util.Arrays;
import java.util.Locale;

/**
 * A catalogue region.
 *
 * <p>The part service is deployed per region and the region is the path prefix:
 * {@code /eupartservice/search}, {@code /appartservice/search},
 * {@code /acpartservice/search}. Same contract and same response shape
 * everywhere — but <em>not</em> the same answers: stock, lead time, pricing,
 * lifecycle status and the stocking sites are all regional, because they come
 * from that region's warehouses and ERP.
 *
 * <p>That is why region is a first-class input rather than deployment config: a
 * board built in Penang and the same board built in Munich get different
 * availability for the identical part number.
 */
public enum Region {

    EU("eu", "Europe"),
    AP("ap", "Asia Pacific"),
    AC("ac", "Americas");

    private final String code;
    private final String label;

    Region(String code, String label) {
        this.code = code;
        this.label = label;
    }

    /** Lower-case path prefix, e.g. "eu" in /eupartservice/search. */
    public String code() { return code; }

    public String label() { return label; }

    /** Service path for this region, e.g. "/eupartservice/search". */
    public String searchPath() { return "/" + code + "partservice/search"; }

    /**
     * Parse a region code, case-insensitively. Accepts the enum name too, so
     * both {@code ap} and {@code AP} work from config or a query parameter.
     *
     * @throws IllegalArgumentException when the code is not a known region —
     *         mapped to a 400 rather than silently falling back, so a typo does
     *         not quietly return another region's stock figures.
     */
    public static Region of(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Region is required.");
        }
        String v = value.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(r -> r.code.equals(v))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown region '" + value + "'. Expected one of: "
                                + Arrays.stream(values()).map(Region::code).toList()));
    }

    /** As {@link #of(String)} but falls back to {@code fallback} when blank. */
    public static Region orDefault(String value, Region fallback) {
        return value == null || value.isBlank() ? fallback : of(value);
    }
}
