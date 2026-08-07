package com.arrow.dws.api.dto;

import java.util.List;

/**
 * One row in a tab — a diagram, a part, a document, a query, a supplier.
 *
 * <p>Every row is the same shape, so a client writes one renderer rather than
 * one per tab, and a row gaining a field needs no client change.
 *
 * @param key      stable identifier within the tab
 * @param title    the row's heading
 * @param subtitle secondary line, or null
 * @param fields   the row's own pairs, in display order
 */
public record ItemView(String key, String title, String subtitle, List<FieldView> fields) {

    public ItemView {
        fields = List.copyOf(fields);
    }
}
