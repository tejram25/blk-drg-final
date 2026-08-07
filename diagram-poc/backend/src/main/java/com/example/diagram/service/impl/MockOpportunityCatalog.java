package com.example.diagram.service.impl;

import java.util.List;
import java.util.Map;

/**
 * The three opportunities the POC serves. Static, in code, on purpose — there
 * is nothing to migrate and nothing to seed, so the whole fixture is readable
 * in one place and a reviewer can see exactly what Salesforce will get.
 *
 * <p>The numbers mirror the Design Workspace prototype so the embedded view and
 * the workspace tell the same story about the same projects.
 */
final class MockOpportunityCatalog {

    private MockOpportunityCatalog() {}

    /** A block diagram belonging to the project. */
    record Diagram(String id, String name, String revision, String status, String updated, String previewNote) {}

    /** A part on the bill of materials. */
    record Part(String mpn, String manufacturer, String function, String lifecycle, String leadTime, String stock) {}

    /** A document in the project's repository. */
    record Document(String name, String kind, String size, String updated, boolean customerVisible) {}

    /** An open or closed support thread. */
    record Query(String ref, String subject, String status, String age, String owner) {}

    /** An AI suggestion for the design. */
    record Suggestion(String title, String rationale, String confidence) {}

    /** A supplier engaged on the project. */
    record Supplier(String name, String role, String status, String contact) {}

    /**
     * One opportunity and everything the seven tabs need.
     *
     * @param internalMargin an internal-only figure, dropped when embed=true —
     *                       it exists so the embed variant has something real to
     *                       withhold rather than merely claiming to
     */
    record Opportunity(
            String opportunityId,
            String projectId,
            String name,
            String customer,
            String value,
            String stage,
            String region,
            String owner,
            String description,
            String timelineStart,
            String timelineEnd,
            List<String> statusFlags,
            String internalMargin,
            List<Diagram> diagrams,
            List<Part> parts,
            List<Document> documents,
            List<Query> queries,
            List<Suggestion> suggestions,
            List<Supplier> suppliers) {
    }

    /** Lifecycle stages, in order — the overview tab draws a bar from this. */
    static final List<String> STAGES = List.of(
            "Early/Concept", "Design Phase", "Validation/Testing",
            "Pre-production", "Production", "Late Entry");

    private static final Opportunity EV_BMS = new Opportunity(
            "0061t00000AbCdEfGhI", "PRJ-001",
            "EV Battery Management System", "Tesla Motors",
            "$2.4M", "Design Phase", "AC", "John Smith",
            "48 V automotive battery management for a 16-cell pack, ASIL-B, "
                    + "targeting 10k units a year. Cell balancing and pack interconnect "
                    + "are the open design questions.",
            "2024-08-15", "2025-06-30",
            List.of("My Active"),
            "31.4%",
            List.of(
                    new Diagram("BD-1180", "Power Architecture", "Rev C", "Approved", "2 days ago",
                            "48 V rail, pre-charge, isolation"),
                    new Diagram("BD-1184", "Cell Balancing", "Rev B", "In review", "5 days ago",
                            "passive balancing across 16 cells"),
                    new Diagram("BD-1191", "BMS Sense Chain", "Rev A", "Draft", "yesterday",
                            "sense lines and fault detection")),
            List.of(
                    new Part("LTC6811-1", "Analog Devices", "Battery stack monitor", "Active", "18 weeks", "1,240"),
                    new Part("TPS54360", "Texas Instruments", "Step-down converter", "Active", "12 weeks", "8,600"),
                    new Part("STM32G474RE", "STMicroelectronics", "MCU", "Active", "22 weeks", "410"),
                    new Part("ISO1042", "Texas Instruments", "Isolated CAN transceiver", "NRND", "26 weeks", "0")),
            List.of(
                    new Document("Power Architecture Rev C.pdf", "Diagram export", "1.8 MB", "2 days ago", true),
                    new Document("Preliminary BOM.xlsx", "Bill of materials", "94 KB", "1 week ago", true),
                    new Document("Thermal design note.md", "Engineering note", "12 KB", "3 weeks ago", false),
                    new Document("Customer RFQ.docx", "Customer document", "220 KB", "5 weeks ago", false)),
            List.of(
                    new Query("Q-4471", "ISO1042 is NRND — confirm replacement", "Open", "3 days", "John Smith"),
                    new Query("Q-4460", "Isolation rating for the sense chain", "Answered", "2 weeks", "Field apps")),
            List.of(
                    new Suggestion("Replace ISO1042 with ISO1042-Q1",
                            "Same footprint and isolation rating, automotive-qualified, and it is not NRND.", "High"),
                    new Suggestion("Consider LTC6813 for the monitor",
                            "18 cells instead of 16 leaves headroom if the pack grows.", "Medium"),
                    new Suggestion("Second source the step-down converter",
                            "A single 12-week part on the critical path is the main schedule risk.", "Medium")),
            List.of(
                    new Supplier("Analog Devices", "Monitor IC", "Engaged", "Field apps assigned"),
                    new Supplier("Texas Instruments", "Power and isolation", "Engaged", "Samples sent"),
                    new Supplier("STMicroelectronics", "MCU", "Quoted", "Awaiting volume pricing")));

    private static final Opportunity SMART_GRID = new Opportunity(
            "0061t00000JkLmNoPqRs", "PRJ-003",
            "Smart Grid Controller", "ABB Ltd",
            "$1.5M", "Pre-production", "AP", "Mike Johnson",
            "Grid-edge controller for medium-voltage distribution. Design is "
                    + "frozen; the work now is qualification and supply assurance.",
            "2024-05-10", "2025-02-28",
            List.of("My Active"),
            "27.9%",
            List.of(
                    new Diagram("BD-0902", "Controller Architecture", "Rev D", "Approved", "3 weeks ago",
                            "dual-core controller, redundant supply"),
                    new Diagram("BD-0915", "Protection and Isolation", "Rev B", "Approved", "3 weeks ago",
                            "surge and creepage strategy")),
            List.of(
                    new Part("AM2634", "Texas Instruments", "Real-time MCU", "Active", "20 weeks", "760"),
                    new Part("ADUM4160", "Analog Devices", "USB isolator", "Active", "14 weeks", "3,100"),
                    new Part("MAX31855", "Analog Devices", "Thermocouple front end", "Active", "9 weeks", "5,400")),
            List.of(
                    new Document("Controller Architecture Rev D.pdf", "Diagram export", "2.4 MB", "3 weeks ago", true),
                    new Document("Qualification plan.pdf", "Test plan", "610 KB", "1 month ago", true),
                    new Document("Production BOM.xlsx", "Bill of materials", "140 KB", "3 weeks ago", true)),
            List.of(
                    new Query("Q-4102", "Conformal coating for the coastal deployment", "Answered", "6 weeks", "Field apps")),
            List.of(
                    new Suggestion("Lock a buffer on the real-time MCU",
                            "20-week lead time against a February production date leaves no slack.", "High"),
                    new Suggestion("Reference design GRID-114 matches this topology",
                            "Already qualified for the same voltage class; worth comparing the protection stage.", "Medium")),
            List.of(
                    new Supplier("Texas Instruments", "MCU", "Committed", "Allocation confirmed"),
                    new Supplier("Analog Devices", "Isolation and sensing", "Engaged", "Quotes in")));

    private static final Opportunity RAIL_SIGNALLING = new Opportunity(
            "0061t00000TuVwXyZaBc", "PRJ-008",
            "Railway Signaling System", "Hitachi Rail",
            "$4.5M", "Validation/Testing", "AP", "Anna Martinez",
            "Trackside signalling interface, SIL-4 target. Validation is under "
                    + "way and two findings are open against the power stage.",
            "2024-06-18", "2025-08-20",
            List.of("My Active", "Needs Action"),
            "24.2%",
            List.of(
                    new Diagram("BD-1330", "Signalling Interface", "Rev B", "In review", "4 days ago",
                            "vital I/O and watchdog"),
                    new Diagram("BD-1338", "Redundant Power Stage", "Rev C", "Needs rework", "yesterday",
                            "dual-feed with cross-monitoring"),
                    new Diagram("BD-1341", "Trackside Connector Map", "Rev A", "Draft", "6 days ago",
                            "pinout and cable schedule")),
            List.of(
                    new Part("TMS570LC4357", "Texas Instruments", "Lockstep MCU", "Active", "24 weeks", "180"),
                    new Part("LM5164", "Texas Instruments", "Wide-Vin converter", "Active", "16 weeks", "2,900"),
                    new Part("MAX14827", "Analog Devices", "Industrial transceiver", "Active", "11 weeks", "1,050"),
                    new Part("SN65HVD255", "Texas Instruments", "CAN transceiver", "Last time buy", "30 weeks", "60")),
            List.of(
                    new Document("Redundant Power Stage Rev C.pdf", "Diagram export", "3.1 MB", "yesterday", false),
                    new Document("Validation findings.xlsx", "Test report", "180 KB", "4 days ago", false),
                    new Document("SIL-4 evidence pack.pdf", "Compliance", "6.2 MB", "2 weeks ago", true)),
            List.of(
                    new Query("Q-4489", "Cross-monitoring latency exceeds budget", "Open", "1 day", "Anna Martinez"),
                    new Query("Q-4487", "SN65HVD255 last time buy — quantity needed", "Open", "4 days", "Supply"),
                    new Query("Q-4470", "Connector derating at 85 °C", "Answered", "3 weeks", "Field apps")),
            List.of(
                    new Suggestion("Move to SN65HVD257 before the last time buy closes",
                            "Pin-compatible, active lifecycle, and it removes the only end-of-life part.", "High"),
                    new Suggestion("Split the cross-monitor onto a dedicated comparator",
                            "The latency finding is a firmware round trip; hardware would meet the budget.", "Medium")),
            List.of(
                    new Supplier("Texas Instruments", "MCU and power", "Engaged", "Escalated on lead time"),
                    new Supplier("Analog Devices", "Industrial interface", "Engaged", "Samples received"),
                    new Supplier("Harting", "Connectors", "Quoted", "Awaiting derating data")));

    private static final Map<String, Opportunity> BY_ID = Map.of(
            EV_BMS.opportunityId(), EV_BMS,
            SMART_GRID.opportunityId(), SMART_GRID,
            RAIL_SIGNALLING.opportunityId(), RAIL_SIGNALLING);

    /** The opportunity with this Salesforce id, or null if we hold no project for it. */
    static Opportunity find(String opportunityId) {
        return opportunityId == null ? null : BY_ID.get(opportunityId.trim());
    }

    /** Every id the POC answers for — handy in tests and in the docs. */
    static List<String> knownIds() {
        return List.of(EV_BMS.opportunityId(), SMART_GRID.opportunityId(), RAIL_SIGNALLING.opportunityId());
    }
}
