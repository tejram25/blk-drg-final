package com.arrow.dws.adapter.persistence;

import com.arrow.dws.domain.model.BlockDiagram;
import com.arrow.dws.domain.model.Confidence;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.DesignDocument;
import com.arrow.dws.domain.model.DesignFlag;
import com.arrow.dws.domain.model.LifecycleStage;
import com.arrow.dws.domain.model.PartLifecycle;
import com.arrow.dws.domain.model.PartUsage;
import com.arrow.dws.domain.model.Suggestion;
import com.arrow.dws.domain.model.SupplierEngagement;
import com.arrow.dws.domain.model.SupportQuery;
import com.arrow.dws.domain.model.WorkStatus;
import com.arrow.dws.domain.port.DesignRepository;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The POC's data: three designs held in code.
 *
 * <p>An adapter behind {@link DesignRepository}, so replacing it with JPA is a
 * new class and a profile switch — no use case, controller or tab contributor
 * changes. The {@code !jpa} profile exists so the swap is a configuration
 * decision rather than a deletion.
 *
 * <p>The numbers mirror the Design Workspace prototype, so the embed and the
 * workspace tell the same story about the same projects.
 */
@Repository
@Profile("!jpa")
public class InMemoryDesignRepository implements DesignRepository {

    private final Map<String, Design> byId = new LinkedHashMap<>();
    private final Map<String, Design> byOpportunityId = new LinkedHashMap<>();

    public InMemoryDesignRepository() {
        List.of(evBatteryManagement(), smartGridController(), railwaySignalling())
                .forEach(this::index);
    }

    private void index(Design design) {
        byId.put(design.id(), design);
        design.linkedOpportunityId().ifPresent(oppId -> byOpportunityId.put(oppId, design));
    }

    @Override
    public Optional<Design> findByOpportunityId(String opportunityId) {
        return opportunityId == null
                ? Optional.empty()
                : Optional.ofNullable(byOpportunityId.get(opportunityId.trim()));
    }

    @Override
    public Optional<Design> findById(String designId) {
        return designId == null ? Optional.empty() : Optional.ofNullable(byId.get(designId.trim()));
    }

    @Override
    public List<Design> findAll() {
        return List.copyOf(byId.values());
    }

    // ------------------------------------------------------------ fixtures

    private static Design evBatteryManagement() {
        return new Design(
                "PRJ-001",
                "EV Battery Management System",
                "Tesla Motors",
                "48 V automotive battery management for a 16-cell pack, ASIL-B, targeting "
                        + "10k units a year. Cell balancing and pack interconnect are the open questions.",
                "AC",
                "John Smith",
                "$2.4M",
                LifecycleStage.DESIGN,
                LocalDate.of(2024, 8, 15),
                LocalDate.of(2025, 6, 30),
                List.of(DesignFlag.MY_ACTIVE),
                "31.4%",
                "0061t00000AbCdEfGhI",
                List.of(
                        new BlockDiagram("BD-1180", "Power Architecture",
                                "48 V rail, pre-charge, isolation", "Rev C",
                                WorkStatus.APPROVED, "2 days ago"),
                        new BlockDiagram("BD-1184", "Cell Balancing",
                                "passive balancing across 16 cells", "Rev B",
                                WorkStatus.IN_REVIEW, "5 days ago"),
                        new BlockDiagram("BD-1191", "BMS Sense Chain",
                                "sense lines and fault detection", "Rev A",
                                WorkStatus.DRAFT, "yesterday")),
                List.of(
                        new PartUsage("LTC6811-1", "Analog Devices", "Battery stack monitor",
                                PartLifecycle.ACTIVE, "18 weeks", "1,240"),
                        new PartUsage("TPS54360", "Texas Instruments", "Step-down converter",
                                PartLifecycle.ACTIVE, "12 weeks", "8,600"),
                        new PartUsage("STM32G474RE", "STMicroelectronics", "MCU",
                                PartLifecycle.ACTIVE, "22 weeks", "410"),
                        new PartUsage("ISO1042", "Texas Instruments", "Isolated CAN transceiver",
                                PartLifecycle.NRND, "26 weeks", "0")),
                List.of(
                        new DesignDocument("Power Architecture Rev C.pdf", "Diagram export",
                                "1.8 MB", "2 days ago", com.arrow.dws.domain.model.Visibility.CUSTOMER_VISIBLE),
                        new DesignDocument("Preliminary BOM.xlsx", "Bill of materials",
                                "94 KB", "1 week ago", com.arrow.dws.domain.model.Visibility.CUSTOMER_VISIBLE),
                        new DesignDocument("Thermal design note.md", "Engineering note",
                                "12 KB", "3 weeks ago", com.arrow.dws.domain.model.Visibility.INTERNAL),
                        new DesignDocument("Customer RFQ.docx", "Customer document",
                                "220 KB", "5 weeks ago", com.arrow.dws.domain.model.Visibility.INTERNAL)),
                List.of(
                        new SupportQuery("Q-4471", "ISO1042 is NRND — confirm replacement",
                                WorkStatus.OPEN, "3 days", "John Smith"),
                        new SupportQuery("Q-4460", "Isolation rating for the sense chain",
                                WorkStatus.ANSWERED, "2 weeks", "Field apps")),
                List.of(
                        new Suggestion("Replace ISO1042 with ISO1042-Q1",
                                "Same footprint and isolation rating, automotive-qualified, and it is not NRND.",
                                Confidence.HIGH),
                        new Suggestion("Consider LTC6813 for the monitor",
                                "18 cells instead of 16 leaves headroom if the pack grows.",
                                Confidence.MEDIUM),
                        new Suggestion("Second source the step-down converter",
                                "A single 12-week part on the critical path is the main schedule risk.",
                                Confidence.MEDIUM)),
                List.of(
                        new SupplierEngagement("Analog Devices", "Monitor IC",
                                WorkStatus.ENGAGED, "Field apps assigned"),
                        new SupplierEngagement("Texas Instruments", "Power and isolation",
                                WorkStatus.ENGAGED, "Samples sent"),
                        new SupplierEngagement("STMicroelectronics", "MCU",
                                WorkStatus.QUOTED, "Awaiting volume pricing")));
    }

    private static Design smartGridController() {
        return new Design(
                "PRJ-003",
                "Smart Grid Controller",
                "ABB Ltd",
                "Grid-edge controller for medium-voltage distribution. Design is frozen; "
                        + "the work now is qualification and supply assurance.",
                "AP",
                "Mike Johnson",
                "$1.5M",
                LifecycleStage.PRE_PRODUCTION,
                LocalDate.of(2024, 5, 10),
                LocalDate.of(2025, 2, 28),
                List.of(DesignFlag.MY_ACTIVE),
                "27.9%",
                "0061t00000JkLmNoPqRs",
                List.of(
                        new BlockDiagram("BD-0902", "Controller Architecture",
                                "dual-core controller, redundant supply", "Rev D",
                                WorkStatus.APPROVED, "3 weeks ago"),
                        new BlockDiagram("BD-0915", "Protection and Isolation",
                                "surge and creepage strategy", "Rev B",
                                WorkStatus.APPROVED, "3 weeks ago")),
                List.of(
                        new PartUsage("AM2634", "Texas Instruments", "Real-time MCU",
                                PartLifecycle.ACTIVE, "20 weeks", "760"),
                        new PartUsage("ADUM4160", "Analog Devices", "USB isolator",
                                PartLifecycle.ACTIVE, "14 weeks", "3,100"),
                        new PartUsage("MAX31855", "Analog Devices", "Thermocouple front end",
                                PartLifecycle.ACTIVE, "9 weeks", "5,400")),
                List.of(
                        new DesignDocument("Controller Architecture Rev D.pdf", "Diagram export",
                                "2.4 MB", "3 weeks ago", com.arrow.dws.domain.model.Visibility.CUSTOMER_VISIBLE),
                        new DesignDocument("Qualification plan.pdf", "Test plan",
                                "610 KB", "1 month ago", com.arrow.dws.domain.model.Visibility.CUSTOMER_VISIBLE),
                        new DesignDocument("Production BOM.xlsx", "Bill of materials",
                                "140 KB", "3 weeks ago", com.arrow.dws.domain.model.Visibility.CUSTOMER_VISIBLE)),
                List.of(
                        new SupportQuery("Q-4102", "Conformal coating for the coastal deployment",
                                WorkStatus.ANSWERED, "6 weeks", "Field apps")),
                List.of(
                        new Suggestion("Lock a buffer on the real-time MCU",
                                "20-week lead time against a February production date leaves no slack.",
                                Confidence.HIGH),
                        new Suggestion("Reference design GRID-114 matches this topology",
                                "Already qualified for the same voltage class; worth comparing the protection stage.",
                                Confidence.MEDIUM)),
                List.of(
                        new SupplierEngagement("Texas Instruments", "MCU",
                                WorkStatus.COMMITTED, "Allocation confirmed"),
                        new SupplierEngagement("Analog Devices", "Isolation and sensing",
                                WorkStatus.ENGAGED, "Quotes in")));
    }

    private static Design railwaySignalling() {
        return new Design(
                "PRJ-008",
                "Railway Signaling System",
                "Hitachi Rail",
                "Trackside signalling interface, SIL-4 target. Validation is under way and "
                        + "two findings are open against the power stage.",
                "AP",
                "Anna Martinez",
                "$4.5M",
                LifecycleStage.VALIDATION,
                LocalDate.of(2024, 6, 18),
                LocalDate.of(2025, 8, 20),
                List.of(DesignFlag.MY_ACTIVE, DesignFlag.NEEDS_ACTION),
                "24.2%",
                "0061t00000TuVwXyZaBc",
                List.of(
                        new BlockDiagram("BD-1330", "Signalling Interface",
                                "vital I/O and watchdog", "Rev B",
                                WorkStatus.IN_REVIEW, "4 days ago"),
                        new BlockDiagram("BD-1338", "Redundant Power Stage",
                                "dual-feed with cross-monitoring", "Rev C",
                                WorkStatus.NEEDS_REWORK, "yesterday"),
                        new BlockDiagram("BD-1341", "Trackside Connector Map",
                                "pinout and cable schedule", "Rev A",
                                WorkStatus.DRAFT, "6 days ago")),
                List.of(
                        new PartUsage("TMS570LC4357", "Texas Instruments", "Lockstep MCU",
                                PartLifecycle.ACTIVE, "24 weeks", "180"),
                        new PartUsage("LM5164", "Texas Instruments", "Wide-Vin converter",
                                PartLifecycle.ACTIVE, "16 weeks", "2,900"),
                        new PartUsage("MAX14827", "Analog Devices", "Industrial transceiver",
                                PartLifecycle.ACTIVE, "11 weeks", "1,050"),
                        new PartUsage("SN65HVD255", "Texas Instruments", "CAN transceiver",
                                PartLifecycle.LAST_TIME_BUY, "30 weeks", "60")),
                List.of(
                        new DesignDocument("Redundant Power Stage Rev C.pdf", "Diagram export",
                                "3.1 MB", "yesterday", com.arrow.dws.domain.model.Visibility.INTERNAL),
                        new DesignDocument("Validation findings.xlsx", "Test report",
                                "180 KB", "4 days ago", com.arrow.dws.domain.model.Visibility.INTERNAL),
                        new DesignDocument("SIL-4 evidence pack.pdf", "Compliance",
                                "6.2 MB", "2 weeks ago", com.arrow.dws.domain.model.Visibility.CUSTOMER_VISIBLE)),
                List.of(
                        new SupportQuery("Q-4489", "Cross-monitoring latency exceeds budget",
                                WorkStatus.OPEN, "1 day", "Anna Martinez"),
                        new SupportQuery("Q-4487", "SN65HVD255 last time buy — quantity needed",
                                WorkStatus.OPEN, "4 days", "Supply"),
                        new SupportQuery("Q-4470", "Connector derating at 85 °C",
                                WorkStatus.ANSWERED, "3 weeks", "Field apps")),
                List.of(
                        new Suggestion("Move to SN65HVD257 before the last time buy closes",
                                "Pin-compatible, active lifecycle, and it removes the only end-of-life part.",
                                Confidence.HIGH),
                        new Suggestion("Split the cross-monitor onto a dedicated comparator",
                                "The latency finding is a firmware round trip; hardware would meet the budget.",
                                Confidence.MEDIUM)),
                List.of(
                        new SupplierEngagement("Texas Instruments", "MCU and power",
                                WorkStatus.ENGAGED, "Escalated on lead time"),
                        new SupplierEngagement("Analog Devices", "Industrial interface",
                                WorkStatus.ENGAGED, "Samples received"),
                        new SupplierEngagement("Harting", "Connectors",
                                WorkStatus.QUOTED, "Awaiting derating data")));
    }
}
