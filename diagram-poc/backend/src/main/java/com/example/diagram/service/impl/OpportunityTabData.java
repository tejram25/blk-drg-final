package com.example.diagram.service.impl;

import com.example.diagram.service.impl.MockOpportunityCatalog.Document;
import com.example.diagram.service.impl.MockOpportunityCatalog.Opportunity;
import com.example.diagram.web.dto.OpportunityTab;
import com.example.diagram.web.dto.TabField;
import com.example.diagram.web.dto.TabItem;

import java.util.ArrayList;
import java.util.List;

/**
 * Builds each tab as data.
 *
 * <p>Every tab lands in the same shape — tab-level pairs, then items that are
 * themselves pairs — so the client writes one renderer rather than seven. The
 * only per-tab knowledge here is <em>which</em> pairs to emit and what tone
 * each value carries; how any of it looks is the client's business.
 */
final class OpportunityTabData {

    private OpportunityTabData() {}

    // ---------------------------------------------------------------- tabs

    static OpportunityTab overview(Opportunity o, boolean embed) {
        List<TabField> fields = new ArrayList<>(List.of(
                TabField.of("projectId", "Project", o.projectId()),
                TabField.of("name", "Name", o.name()),
                TabField.of("customer", "Customer", o.customer()),
                TabField.of("description", "Description", o.description()),
                TabField.of("region", "Region", o.region()),
                TabField.of("owner", "Owner", o.owner()),
                TabField.of("timelineStart", "Start", o.timelineStart()),
                TabField.of("timelineEnd", "Target end", o.timelineEnd()),
                new TabField("stage", "Lifecycle stage", o.stage(), TabField.INFO),
                TabField.of("stagePosition", "Stage position",
                        (MockOpportunityCatalog.STAGES.indexOf(o.stage()) + 1)
                                + " of " + MockOpportunityCatalog.STAGES.size()),
                new TabField("estimatedValue", "Estimated value", o.value(), TabField.POSITIVE)));

        for (String flag : o.statusFlags()) {
            fields.add(new TabField("status." + slug(flag), flag, "Yes",
                    "Needs Action".equals(flag) ? TabField.WARNING : TabField.POSITIVE));
        }
        if (o.statusFlags().isEmpty()) {
            fields.add(new TabField("status.onTrack", "On track", "Yes", TabField.POSITIVE));
        }

        // The one figure the embedded variant withholds. Absent from the
        // payload, not flagged and left in it.
        if (!embed) {
            fields.add(new TabField("margin", "Margin (internal)", o.internalMargin(), TabField.INFO));
        }

        return tab("overview", "Overview", "layout-list", 1, null, embed, fields, List.of(), null);
    }

    static OpportunityTab blockDiagrams(Opportunity o, boolean embed) {
        List<TabItem> items = o.diagrams().stream()
                .map(d -> new TabItem(d.id(), d.name(), d.previewNote(), List.of(
                        TabField.of("revision", "Revision", d.revision()),
                        new TabField("status", "Status", d.status(), statusTone(d.status())),
                        TabField.of("updated", "Updated", d.updated()))))
                .toList();

        return tab("block-diagrams", "Block Diagrams", "workflow", 2,
                count(items.size()), embed,
                List.of(TabField.of("diagramCount", "Diagrams", String.valueOf(items.size()))),
                items,
                embed ? "Opening a diagram loads the canvas read-only, inside this view."
                      : "Open a diagram to edit it on the canvas.");
    }

    static OpportunityTab partIntelligence(Opportunity o, boolean embed) {
        List<TabItem> items = o.parts().stream()
                .map(p -> new TabItem(p.mpn(), p.mpn(), p.manufacturer(), List.of(
                        TabField.of("function", "Function", p.function()),
                        new TabField("lifecycle", "Lifecycle", p.lifecycle(), lifecycleTone(p.lifecycle())),
                        TabField.of("leadTime", "Lead time", p.leadTime()),
                        TabField.of("stock", "Stock", p.stock()))))
                .toList();

        long atRisk = o.parts().stream().filter(p -> !"Active".equals(p.lifecycle())).count();

        return tab("part-intel", "Part Intelligence", "search", 3,
                count(items.size()), embed,
                List.of(
                        TabField.of("partCount", "Parts", String.valueOf(items.size())),
                        new TabField("partsAtRisk", "Not in full production", String.valueOf(atRisk),
                                atRisk == 0 ? TabField.POSITIVE : TabField.WARNING)),
                items,
                atRisk == 0 ? null
                        : atRisk + (atRisk == 1 ? " part is" : " parts are")
                                + " not in full production. See the AI Assistant tab for alternates.");
    }

    static OpportunityTab fastRepository(Opportunity o, boolean embed) {
        // The embedded variant filters the list itself — an internal document
        // is absent, not marked internal and sent anyway.
        List<Document> visible = embed
                ? o.documents().stream().filter(Document::customerVisible).toList()
                : o.documents();
        int withheld = o.documents().size() - visible.size();

        List<TabItem> items = visible.stream()
                .map(d -> {
                    List<TabField> f = new ArrayList<>(List.of(
                            TabField.of("kind", "Kind", d.kind()),
                            TabField.of("size", "Size", d.size()),
                            TabField.of("updated", "Updated", d.updated())));
                    if (!embed) {
                        f.add(new TabField("visibility", "Visibility",
                                d.customerVisible() ? "Customer-visible" : "Internal",
                                d.customerVisible() ? TabField.POSITIVE : TabField.NEUTRAL));
                    }
                    return new TabItem(d.name(), d.name(), d.kind(), List.copyOf(f));
                })
                .toList();

        return tab("fast-repo", "FAST Repository", "database", 4,
                count(items.size()), embed,
                List.of(TabField.of("documentCount", "Documents", String.valueOf(items.size()))),
                items,
                withheld == 0 ? null
                        : withheld + " internal document" + (withheld == 1 ? " is" : "s are")
                                + " not returned to this view.");
    }

    static OpportunityTab support(Opportunity o, boolean embed) {
        List<TabItem> items = o.queries().stream()
                .map(q -> new TabItem(q.ref(), q.subject(), q.ref(), List.of(
                        new TabField("status", "Status", q.status(), statusTone(q.status())),
                        TabField.of("age", "Age", q.age()),
                        TabField.of("owner", "Owner", q.owner()))))
                .toList();

        long open = o.queries().stream().filter(q -> "Open".equals(q.status())).count();

        return tab("support", "Support / Query", "message-circle", 5,
                open == 0 ? null : String.valueOf(open), embed,
                List.of(
                        new TabField("openQueries", "Open", String.valueOf(open),
                                open == 0 ? TabField.POSITIVE : TabField.WARNING),
                        TabField.of("totalQueries", "Total", String.valueOf(items.size()))),
                items, null);
    }

    static OpportunityTab aiAssistant(Opportunity o, boolean embed) {
        List<TabItem> items = new ArrayList<>();
        for (int i = 0; i < o.suggestions().size(); i++) {
            var s = o.suggestions().get(i);
            items.add(new TabItem("suggestion-" + (i + 1), s.title(), null, List.of(
                    new TabField("confidence", "Confidence", s.confidence(), confidenceTone(s.confidence())),
                    TabField.of("rationale", "Why", s.rationale()))));
        }

        return tab("ai-assistant", "AI Assistant", "sparkles", 6,
                count(items.size()), embed,
                List.of(TabField.of("suggestionCount", "Suggestions", String.valueOf(items.size()))),
                List.copyOf(items), null);
    }

    static OpportunityTab suppliers(Opportunity o, boolean embed) {
        List<TabItem> items = o.suppliers().stream()
                .map(s -> new TabItem(slug(s.name()), s.name(), s.role(), List.of(
                        new TabField("status", "Status", s.status(), statusTone(s.status())),
                        TabField.of("latest", "Latest", s.contact()))))
                .toList();

        return tab("supplier-collab", "Suppliers", "users", 7,
                count(items.size()), embed,
                List.of(TabField.of("supplierCount", "Suppliers", String.valueOf(items.size()))),
                items, null);
    }

    // ------------------------------------------------------------- helpers

    private static OpportunityTab tab(String key, String label, String icon, int order, String badge,
                                      boolean embed, List<TabField> fields, List<TabItem> items, String note) {
        return new OpportunityTab(key, label, icon, order, badge, embed, fields, items, note);
    }

    private static String statusTone(String status) {
        return switch (status) {
            case "Approved", "Answered", "Committed" -> TabField.POSITIVE;
            case "In review", "Quoted", "Engaged" -> TabField.INFO;
            case "Needs rework" -> TabField.CRITICAL;
            case "Open" -> TabField.WARNING;
            default -> TabField.NEUTRAL;
        };
    }

    private static String lifecycleTone(String lifecycle) {
        return switch (lifecycle) {
            case "Active" -> TabField.POSITIVE;
            case "NRND" -> TabField.WARNING;
            case "Last time buy" -> TabField.CRITICAL;
            default -> TabField.NEUTRAL;
        };
    }

    private static String confidenceTone(String confidence) {
        return switch (confidence) {
            case "High" -> TabField.POSITIVE;
            case "Medium" -> TabField.WARNING;
            default -> TabField.NEUTRAL;
        };
    }

    private static String count(int n) {
        return n == 0 ? null : String.valueOf(n);
    }

    /** Lower-case, hyphenated — for keys derived from a display name. */
    private static String slug(String s) {
        return s.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
