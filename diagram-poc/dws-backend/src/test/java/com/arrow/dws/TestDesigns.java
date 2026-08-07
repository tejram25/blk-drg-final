package com.arrow.dws;

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
import com.arrow.dws.domain.model.Visibility;
import com.arrow.dws.domain.model.WorkStatus;

import java.time.LocalDate;
import java.util.List;

/**
 * Designs built for a test, not borrowed from the fixture.
 *
 * <p>A test that asserts against the shipped fixture starts failing when
 * someone edits a document name for a demo, which teaches everyone to ignore
 * it. These are small and say exactly what the test needs.
 */
public final class TestDesigns {

    private TestDesigns() {}

    /** A design with one internal and one customer-visible document. */
    public static Design withMixedDocuments() {
        return builder()
                .documents(List.of(
                        new DesignDocument("Public.pdf", "Diagram export", "1 MB", "today",
                                Visibility.CUSTOMER_VISIBLE),
                        new DesignDocument("Secret.md", "Engineering note", "2 KB", "today",
                                Visibility.INTERNAL)))
                .build();
    }

    /** A design carrying one at-risk part among two. */
    public static Design withAtRiskPart() {
        return builder()
                .parts(List.of(
                        new PartUsage("GOOD1", "TI", "Converter", PartLifecycle.ACTIVE, "8 weeks", "500"),
                        new PartUsage("RISKY1", "TI", "Transceiver", PartLifecycle.LAST_TIME_BUY, "30 weeks", "12")))
                .build();
    }

    /** A design with two open queries and one answered. */
    public static Design withOpenQueries() {
        return builder()
                .queries(List.of(
                        new SupportQuery("Q-1", "First", WorkStatus.OPEN, "1 day", "Owner"),
                        new SupportQuery("Q-2", "Second", WorkStatus.OPEN, "2 days", "Owner"),
                        new SupportQuery("Q-3", "Third", WorkStatus.ANSWERED, "3 days", "Owner")))
                .build();
    }

    public static Builder builder() {
        return new Builder();
    }

    /** Minimal, overridable — a test names only what it cares about. */
    public static final class Builder {
        private String id = "PRJ-TEST";
        private String opportunityId = "0061t00000TESTID001";
        private List<DesignFlag> flags = List.of(DesignFlag.ON_TRACK);
        private List<BlockDiagram> diagrams = List.of(
                new BlockDiagram("BD-1", "A diagram", "summary", "Rev A", WorkStatus.DRAFT, "today"));
        private List<PartUsage> parts = List.of(
                new PartUsage("PART1", "TI", "Converter", PartLifecycle.ACTIVE, "8 weeks", "500"));
        private List<DesignDocument> documents = List.of(
                new DesignDocument("Doc.pdf", "Diagram export", "1 MB", "today", Visibility.CUSTOMER_VISIBLE));
        private List<SupportQuery> queries = List.of();
        private List<Suggestion> suggestions = List.of(
                new Suggestion("Do the thing", "Because reasons", Confidence.HIGH));
        private List<SupplierEngagement> suppliers = List.of(
                new SupplierEngagement("Texas Instruments", "Power", WorkStatus.ENGAGED, "Samples sent"));

        public Builder id(String v) { this.id = v; return this; }
        public Builder opportunityId(String v) { this.opportunityId = v; return this; }
        public Builder flags(List<DesignFlag> v) { this.flags = v; return this; }
        public Builder diagrams(List<BlockDiagram> v) { this.diagrams = v; return this; }
        public Builder parts(List<PartUsage> v) { this.parts = v; return this; }
        public Builder documents(List<DesignDocument> v) { this.documents = v; return this; }
        public Builder queries(List<SupportQuery> v) { this.queries = v; return this; }
        public Builder suggestions(List<Suggestion> v) { this.suggestions = v; return this; }
        public Builder suppliers(List<SupplierEngagement> v) { this.suppliers = v; return this; }

        public Design build() {
            return new Design(id, "Test design", "Test Customer", "A brief", "AC", "Test Owner",
                    "$1.0M", LifecycleStage.DESIGN,
                    LocalDate.of(2024, 1, 1), LocalDate.of(2025, 1, 1),
                    flags, "30.0%", opportunityId,
                    diagrams, parts, documents, queries, suggestions, suppliers);
        }
    }
}
