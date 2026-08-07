package com.example.diagram.service.impl;

import com.example.diagram.service.impl.MockOpportunityCatalog.Diagram;
import com.example.diagram.service.impl.MockOpportunityCatalog.Document;
import com.example.diagram.service.impl.MockOpportunityCatalog.Opportunity;
import com.example.diagram.service.impl.MockOpportunityCatalog.Part;
import com.example.diagram.service.impl.MockOpportunityCatalog.Query;
import com.example.diagram.service.impl.MockOpportunityCatalog.Suggestion;
import com.example.diagram.service.impl.MockOpportunityCatalog.Supplier;

import java.util.List;
import java.util.function.Function;

/**
 * Builds the HTML fragment for each tab.
 *
 * <p>Two deliberate choices:
 *
 * <ul>
 *   <li><b>Inline styles, no stylesheet.</b> The host page — Salesforce — has
 *       no Tailwind and no Design Workspace CSS, and we do not want to inject
 *       any. Every fragment carries its own appearance, so it renders the same
 *       wherever it is dropped and cannot collide with the host's styles.
 *   <li><b>Every interpolated value is escaped.</b> The fixture is static today,
 *       so nothing here can carry a payload — but the moment this reads real
 *       project names, notes and query subjects, unescaped output becomes stored
 *       XSS in a customer-facing page. Escaping from the start means that change
 *       is safe by default rather than a thing someone has to remember.
 * </ul>
 */
final class OpportunityTabHtml {

    private OpportunityTabHtml() {}

    // Arrow palette on the workspace's dark surface.
    private static final String INK = "#ffffff";
    private static final String MUTED = "#9ca3af";
    private static final String DIM = "#6b7280";
    private static final String SKY = "#0084D5";
    private static final String GREEN = "#47D7AC";
    private static final String ORANGE = "#FF8674";
    private static final String COPPER = "#FFC845";
    private static final String LINE = "rgba(255,255,255,0.08)";
    private static final String CARD = "rgba(255,255,255,0.04)";

    private static final String FONT =
            "font-family:'Arrow Display','Segoe UI',system-ui,-apple-system,sans-serif;";
    private static final String WRAP =
            "style=\"" + FONT + "background:#0f1419;color:" + INK + ";padding:16px;border-radius:12px;\"";
    private static final String CARD_S =
            "style=\"background:" + CARD + ";border:1px solid " + LINE + ";border-radius:10px;padding:14px;\"";
    private static final String H3 =
            "style=\"margin:0 0 10px;font-size:13px;font-weight:600;color:" + INK + ";\"";
    private static final String TH =
            "style=\"text-align:left;padding:6px 10px;font-size:10px;font-weight:600;letter-spacing:.6px;"
                    + "text-transform:uppercase;color:" + DIM + ";border-bottom:1px solid " + LINE + ";\"";
    private static final String TD =
            "style=\"padding:8px 10px;font-size:12px;color:" + INK + ";border-bottom:1px solid rgba(255,255,255,0.04);\"";
    private static final String TD_MUTED =
            "style=\"padding:8px 10px;font-size:12px;color:" + MUTED + ";border-bottom:1px solid rgba(255,255,255,0.04);\"";
    private static final String TABLE =
            "style=\"width:100%;border-collapse:collapse;\"";
    private static final String GRID2 =
            "style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;\"";

    // ---------------------------------------------------------------- tabs

    static String overview(Opportunity o, boolean embed) {
        int stageIndex = MockOpportunityCatalog.STAGES.indexOf(o.stage());
        StringBuilder bar = new StringBuilder();
        for (int i = 0; i < MockOpportunityCatalog.STAGES.size(); i++) {
            String fill = i <= stageIndex ? SKY : "rgba(255,255,255,0.06)";
            bar.append("<div title=\"").append(esc(MockOpportunityCatalog.STAGES.get(i)))
               .append("\" style=\"flex:1;height:6px;background:").append(fill)
               .append(";border-right:1px solid #0f1419;\"></div>");
        }

        StringBuilder flags = new StringBuilder();
        for (String flag : o.statusFlags()) {
            String colour = "Needs Action".equals(flag) ? COPPER : GREEN;
            flags.append(pill(flag, colour));
        }
        if (o.statusFlags().isEmpty()) flags.append(pill("On Track", GREEN));

        // The one figure the embedded variant withholds. Not hidden with CSS —
        // simply not written into the response.
        String margin = embed ? ""
                : "<div style=\"margin-top:12px;padding-top:10px;border-top:1px solid " + LINE + ";\">"
                        + "<div style=\"font-size:10px;color:" + DIM + ";\">Margin (internal)</div>"
                        + "<div style=\"font-size:14px;font-weight:700;color:" + COPPER + ";\">"
                        + esc(o.internalMargin()) + "</div></div>";

        return wrap(
                "<div " + GRID2 + ">"
                        + "<div " + CARD_S + " style-order=\"1\">"
                        + "<h3 " + H3 + ">Project</h3>"
                        + "<p style=\"margin:0 0 12px;font-size:12px;line-height:1.6;color:" + MUTED + ";\">"
                        + esc(o.description()) + "</p>"
                        + kv("Customer", o.customer()) + kv("Region", o.region()) + kv("Owner", o.owner())
                        + kv("Timeline", o.timelineStart() + " → " + o.timelineEnd())
                        + margin
                        + "</div>"
                        + "<div " + CARD_S + ">"
                        + "<h3 " + H3 + ">Status</h3>"
                        + "<div style=\"display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;\">" + flags + "</div>"
                        + "<div style=\"font-size:10px;color:" + DIM + ";margin-bottom:6px;\">Lifecycle stage</div>"
                        + "<div style=\"display:flex;border-radius:3px;overflow:hidden;margin-bottom:6px;\">" + bar + "</div>"
                        + "<div style=\"font-size:11px;color:" + SKY + ";font-weight:600;\">" + esc(o.stage()) + "</div>"
                        + "<div style=\"margin-top:14px;padding-top:12px;border-top:1px solid " + LINE + ";\">"
                        + "<div style=\"font-size:10px;color:" + DIM + ";\">Estimated value</div>"
                        + "<div style=\"font-size:20px;font-weight:700;color:" + GREEN + ";\">" + esc(o.value()) + "</div>"
                        + "</div></div></div>");
    }

    static String blockDiagrams(Opportunity o, boolean embed) {
        String rows = rows(o.diagrams(), d ->
                "<tr>"
                        + "<td " + TD + "><div style=\"font-weight:600;\">" + esc(d.name()) + "</div>"
                        + "<div style=\"font-size:11px;color:" + DIM + ";\">" + esc(d.previewNote()) + "</div></td>"
                        + "<td " + TD_MUTED + ">" + esc(d.revision()) + "</td>"
                        + "<td " + TD + ">" + statusPill(d.status()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(d.updated()) + "</td>"
                        + "</tr>");

        String note = embed
                ? note("Previews only. Opening a diagram loads the canvas read-only, inside this view.")
                : note("Open a diagram to edit it on the canvas.");

        return wrap("<div " + CARD_S + "><h3 " + H3 + ">Block diagrams</h3>"
                + "<table " + TABLE + "><thead><tr>"
                + "<th " + TH + ">Diagram</th><th " + TH + ">Revision</th>"
                + "<th " + TH + ">Status</th><th " + TH + ">Updated</th>"
                + "</tr></thead><tbody>" + rows + "</tbody></table>" + note + "</div>");
    }

    static String partIntelligence(Opportunity o, boolean embed) {
        String rows = rows(o.parts(), p ->
                "<tr>"
                        + "<td " + TD + "><div style=\"font-weight:600;\">" + esc(p.mpn()) + "</div>"
                        + "<div style=\"font-size:11px;color:" + DIM + ";\">" + esc(p.manufacturer()) + "</div></td>"
                        + "<td " + TD_MUTED + ">" + esc(p.function()) + "</td>"
                        + "<td " + TD + ">" + lifecyclePill(p.lifecycle()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(p.leadTime()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(p.stock()) + "</td>"
                        + "</tr>");

        long atRisk = o.parts().stream()
                .filter(p -> !"Active".equals(p.lifecycle())).count();
        String warn = atRisk == 0 ? "" : note(atRisk
                + (atRisk == 1 ? " part on this design is" : " parts on this design are")
                + " not in full production. See the AI Assistant tab for alternates.");

        return wrap("<div " + CARD_S + "><h3 " + H3 + ">Parts on this design</h3>"
                + "<table " + TABLE + "><thead><tr>"
                + "<th " + TH + ">Part</th><th " + TH + ">Function</th><th " + TH + ">Lifecycle</th>"
                + "<th " + TH + ">Lead time</th><th " + TH + ">Stock</th>"
                + "</tr></thead><tbody>" + rows + "</tbody></table>" + warn + "</div>");
    }

    static String fastRepository(Opportunity o, boolean embed) {
        // In the embedded variant the list itself is filtered — an internal
        // document is not greyed out, it is absent.
        List<Document> visible = embed
                ? o.documents().stream().filter(Document::customerVisible).toList()
                : o.documents();

        String rows = rows(visible, d ->
                "<tr>"
                        + "<td " + TD + "><span style=\"font-weight:600;\">" + esc(d.name()) + "</span></td>"
                        + "<td " + TD_MUTED + ">" + esc(d.kind()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(d.size()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(d.updated()) + "</td>"
                        + (embed ? "" : "<td " + TD + ">"
                                + (d.customerVisible() ? pill("Customer-visible", GREEN) : pill("Internal", DIM))
                                + "</td>")
                        + "</tr>");

        String hidden = embed && visible.size() < o.documents().size()
                ? note((o.documents().size() - visible.size())
                        + " internal document(s) are not returned to this view.")
                : "";

        return wrap("<div " + CARD_S + "><h3 " + H3 + ">Repository</h3>"
                + "<table " + TABLE + "><thead><tr>"
                + "<th " + TH + ">Document</th><th " + TH + ">Kind</th><th " + TH + ">Size</th>"
                + "<th " + TH + ">Updated</th>" + (embed ? "" : "<th " + TH + ">Visibility</th>")
                + "</tr></thead><tbody>" + rows + "</tbody></table>" + hidden + "</div>");
    }

    static String support(Opportunity o, boolean embed) {
        String rows = rows(o.queries(), q ->
                "<tr>"
                        + "<td " + TD_MUTED + ">" + esc(q.ref()) + "</td>"
                        + "<td " + TD + ">" + esc(q.subject()) + "</td>"
                        + "<td " + TD + ">" + statusPill(q.status()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(q.age()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(q.owner()) + "</td>"
                        + "</tr>");

        String action = embed ? "" : button("Raise a query");

        return wrap("<div " + CARD_S + "><h3 " + H3 + ">Support and queries</h3>"
                + "<table " + TABLE + "><thead><tr>"
                + "<th " + TH + ">Ref</th><th " + TH + ">Subject</th><th " + TH + ">Status</th>"
                + "<th " + TH + ">Age</th><th " + TH + ">Owner</th>"
                + "</tr></thead><tbody>" + rows + "</tbody></table>" + action + "</div>");
    }

    static String aiAssistant(Opportunity o, boolean embed) {
        StringBuilder cards = new StringBuilder();
        for (Suggestion s : o.suggestions()) {
            String colour = switch (s.confidence()) {
                case "High" -> GREEN;
                case "Medium" -> COPPER;
                default -> DIM;
            };
            cards.append("<div style=\"padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);\">")
                 .append("<div style=\"display:flex;justify-content:space-between;gap:12px;align-items:flex-start;\">")
                 .append("<div style=\"font-size:12.5px;font-weight:600;\">").append(esc(s.title())).append("</div>")
                 .append(pill(s.confidence() + " confidence", colour))
                 .append("</div><p style=\"margin:6px 0 0;font-size:11.5px;line-height:1.6;color:")
                 .append(MUTED).append(";\">").append(esc(s.rationale())).append("</p></div>");
        }

        String action = embed ? "" : button("Ask the assistant");

        return wrap("<div " + CARD_S + "><h3 " + H3 + ">Suggestions for this design</h3>"
                + cards + action + "</div>");
    }

    static String suppliers(Opportunity o, boolean embed) {
        String rows = rows(o.suppliers(), s ->
                "<tr>"
                        + "<td " + TD + "><span style=\"font-weight:600;\">" + esc(s.name()) + "</span></td>"
                        + "<td " + TD_MUTED + ">" + esc(s.role()) + "</td>"
                        + "<td " + TD + ">" + statusPill(s.status()) + "</td>"
                        + "<td " + TD_MUTED + ">" + esc(s.contact()) + "</td>"
                        + "</tr>");

        return wrap("<div " + CARD_S + "><h3 " + H3 + ">Supplier collaboration</h3>"
                + "<table " + TABLE + "><thead><tr>"
                + "<th " + TH + ">Supplier</th><th " + TH + ">Role</th>"
                + "<th " + TH + ">Status</th><th " + TH + ">Latest</th>"
                + "</tr></thead><tbody>" + rows + "</tbody></table></div>");
    }

    // ------------------------------------------------------------- helpers

    private static <T> String rows(List<T> items, Function<T, String> row) {
        if (items.isEmpty()) {
            return "<tr><td " + TD_MUTED + " colspan=\"6\">Nothing here yet.</td></tr>";
        }
        StringBuilder sb = new StringBuilder();
        items.forEach(i -> sb.append(row.apply(i)));
        return sb.toString();
    }

    private static String wrap(String body) {
        return "<div " + WRAP + ">" + body + "</div>";
    }

    private static String kv(String label, String value) {
        return "<div style=\"display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px;\">"
                + "<span style=\"color:" + DIM + ";\">" + esc(label) + "</span>"
                + "<span style=\"color:" + INK + ";font-weight:500;text-align:right;\">" + esc(value) + "</span></div>";
    }

    private static String pill(String text, String colour) {
        return "<span style=\"display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;"
                + "font-weight:600;color:" + colour + ";background:" + colour + "1f;white-space:nowrap;\">"
                + esc(text) + "</span>";
    }

    private static String statusPill(String status) {
        String colour = switch (status) {
            case "Approved", "Answered", "Committed" -> GREEN;
            case "In review", "Quoted", "Engaged" -> SKY;
            case "Needs rework", "Open" -> ORANGE;
            default -> DIM;
        };
        return pill(status, colour);
    }

    private static String lifecyclePill(String lifecycle) {
        String colour = switch (lifecycle) {
            case "Active" -> GREEN;
            case "NRND" -> COPPER;
            case "Last time buy" -> ORANGE;
            default -> DIM;
        };
        return pill(lifecycle, colour);
    }

    private static String note(String text) {
        return "<p style=\"margin:12px 0 0;font-size:11px;color:" + DIM + ";\">" + esc(text) + "</p>";
    }

    private static String button(String label) {
        return "<div style=\"margin-top:14px;\"><span style=\"display:inline-block;padding:7px 14px;"
                + "border-radius:8px;background:" + SKY + ";color:#fff;font-size:12px;font-weight:600;\">"
                + esc(label) + "</span></div>";
    }

    /** Escape for an HTML text node or a double-quoted attribute value. */
    private static String esc(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&#39;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }
}
