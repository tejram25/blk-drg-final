package com.example.diagram.web.dto;

import java.util.List;

/**
 * One tab of the opportunity view, as data.
 *
 * <p>No markup: the client renders. Every tab has the same shape — some
 * tab-level key/value pairs, then a list of items that are each themselves a
 * set of key/value pairs — so one renderer covers all seven, and a tab gaining
 * a field does not need a change on the Salesforce side.
 *
 * @param key      stable identifier, safe in a URL or a DOM id
 * @param label    what the user sees on the tab
 * @param icon     Lucide icon name, matching the workspace UI
 * @param order    display order, ascending
 * @param badge    short count or status for the tab strip, or null for none
 * @param readOnly true when this variant carries no actions
 * @param fields   tab-level pairs — the summary above the list
 * @param items    the rows; empty when the tab is only a summary
 * @param note     one line of context to show under the tab, or null
 */
public record OpportunityTab(
        String key,
        String label,
        String icon,
        int order,
        String badge,
        boolean readOnly,
        List<TabField> fields,
        List<TabItem> items,
        String note) {
}
