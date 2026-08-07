package com.example.diagram.web.dto;

/**
 * One tab of the opportunity view, ready to render.
 *
 * <p>{@code html} is a self-contained fragment — a {@code <div>} and its
 * children, no {@code <html>}/{@code <body>} wrapper and no {@code <script>}.
 * The host drops it straight into a container. Styling uses the same utility
 * classes as the Design Workspace UI, so the fragment looks identical wherever
 * it lands.
 *
 * @param key        stable identifier, safe to use in a URL or a DOM id
 * @param label      what the user sees on the tab
 * @param icon       Lucide icon name, matching the workspace UI
 * @param order      display order, ascending
 * @param badge      short count or status shown on the tab, or null for none
 * @param readOnly   true when the fragment carries no action controls
 * @param contentType always {@code text/html} today; present so a future tab
 *                    can return something else without breaking clients
 * @param html       the fragment itself
 */
public record OpportunityTab(
        String key,
        String label,
        String icon,
        int order,
        String badge,
        boolean readOnly,
        String contentType,
        String html) {
}
