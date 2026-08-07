package com.example.diagram.web.dto;

import java.util.List;

/**
 * One row in a tab — a diagram, a part, a document, a query, a supplier.
 *
 * <p>Every item is the same shape: an identity, a heading, and its own list of
 * key/value pairs. A client writes one renderer and it works for all seven
 * tabs; adding a field to a row is then a server change, not a Salesforce
 * release.
 *
 * @param key      stable identifier within the tab
 * @param title    the row's heading
 * @param subtitle secondary line, or null
 * @param fields   the row's own key/value pairs, in display order
 */
public record TabItem(String key, String title, String subtitle, List<TabField> fields) {
}
