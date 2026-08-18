package com.arrow.dws.api.dto;

import java.util.List;

/**
 * One tab, as data. No markup — the client renders.
 *
 * @param key      stable identifier, safe in a URL or a DOM id
 * @param label    what the user sees on the tab
 * @param icon     Lucide icon name, matching the workspace UI
 * @param order    display order, ascending
 * @param badge    short count for the tab strip, or null for none
 * @param readOnly true when this audience may not act
 * @param fields   tab-level pairs — the summary above the list
 * @param items    the rows; empty when the tab is only a summary
 * @param note     one line of context, or null
 */
public record TabView(
        String key,
        String label,
        String icon,
        int order,
        String badge,
        boolean readOnly,
        List<FieldView> fields,
        List<ItemView> items,
        String note) {

    public TabView {
        fields = List.copyOf(fields);
        items = List.copyOf(items);
    }
}
