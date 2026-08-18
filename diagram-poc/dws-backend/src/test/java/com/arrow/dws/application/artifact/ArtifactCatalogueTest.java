package com.arrow.dws.application.artifact;

import com.arrow.dws.TestDesigns;
import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactFormat;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.BlockDiagram;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.WorkStatus;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ArtifactCatalogueTest {

    private final ArtifactCatalogue catalogue = new ArtifactCatalogue();

    /** The format is decided by what a thing is, not by whoever asks for it. */
    @ParameterizedTest
    @EnumSource(ArtifactKind.class)
    void everyKindHasExactlyOneFormat(ArtifactKind kind) {
        assertThat(kind.format()).isNotNull();
        assertThat(kind.label()).isNotBlank();
    }

    @Test
    void diagramsAreImagesAndEverythingElseIsPdfOrSpreadsheet() {
        List<Artifact> artifacts = catalogue.artifactsFor(TestDesigns.builder().build(), Audience.INTERNAL);

        assertThat(artifacts).isNotEmpty();
        assertThat(artifacts).allSatisfy(a -> {
            if (a.kind() == ArtifactKind.BLOCK_DIAGRAM) {
                assertThat(a.format()).isEqualTo(ArtifactFormat.PNG);
            } else {
                assertThat(a.format()).isIn(ArtifactFormat.PDF, ArtifactFormat.XLSX);
            }
            assertThat(a.fileName()).endsWith("." + a.format().extension());
        });
    }

    @Test
    void idsAreUniqueAndUrlSafe() {
        List<Artifact> artifacts = catalogue.artifactsFor(TestDesigns.withMixedDocuments(), Audience.INTERNAL);

        assertThat(artifacts).extracting(Artifact::id).doesNotHaveDuplicates();
        assertThat(artifacts).allSatisfy(a ->
                assertThat(a.id()).matches("[A-Za-z0-9._-]+"));
    }

    /** An internal document must not produce a customer-visible artifact. */
    @Test
    void artifactsInheritTheVisibilityOfTheirSource() {
        Design design = TestDesigns.withMixedDocuments();

        List<String> embedded = catalogue.artifactsFor(design, Audience.EMBEDDED).stream()
                .map(Artifact::title).toList();
        List<String> internal = catalogue.artifactsFor(design, Audience.INTERNAL).stream()
                .map(Artifact::title).toList();

        assertThat(internal).contains("Public", "Secret");
        assertThat(embedded).contains("Public").doesNotContain("Secret");
    }

    /** A diagram still being reworked is not something to hand a customer. */
    @Test
    void onlyApprovedDiagramsReachARestrictedAudience() {
        Design design = TestDesigns.builder().diagrams(List.of(
                new BlockDiagram("BD-OK", "Approved one", "s", "Rev C", WorkStatus.APPROVED, "today"),
                new BlockDiagram("BD-WIP", "Draft one", "s", "Rev A", WorkStatus.DRAFT, "today"))).build();

        assertThat(catalogue.artifactsFor(design, Audience.EMBEDDED))
                .extracting(Artifact::id).contains("diagram-BD-OK").doesNotContain("diagram-BD-WIP");
        assertThat(catalogue.artifactsFor(design, Audience.INTERNAL))
                .extracting(Artifact::id).contains("diagram-BD-OK", "diagram-BD-WIP");
    }

    /** The query log is internal — open questions are not a customer document. */
    @Test
    void theQueryLogNeverReachesARestrictedAudience() {
        Design design = TestDesigns.withOpenQueries();

        assertThat(catalogue.artifactsFor(design, Audience.INTERNAL))
                .extracting(Artifact::id).contains("query-log");
        assertThat(catalogue.artifactsFor(design, Audience.EMBEDDED))
                .extracting(Artifact::id).doesNotContain("query-log");
    }

    /** find() must apply the same filter as the list, or the URL is a bypass. */
    @Test
    void findAppliesTheSameAudienceFilterAsTheList() {
        Design design = TestDesigns.withOpenQueries();

        assertThat(catalogue.find(design, Audience.INTERNAL, "query-log")).isPresent();
        assertThat(catalogue.find(design, Audience.EMBEDDED, "query-log")).isEmpty();
    }

    /**
     * The download header sends the filename unencoded, which is only safe
     * while filenames are ASCII. If the sanitiser is ever loosened, this fails
     * before a customer receives a file called "=?UTF-8?Q?...?=".
     */
    @Test
    void fileNamesStayAscii() {
        Design design = TestDesigns.builder()
                .id("PRJ — 85 °C")
                .build();

        assertThat(catalogue.artifactsFor(design, Audience.INTERNAL))
                .allSatisfy(a -> assertThat(a.fileName()).matches("[A-Za-z0-9 ._-]+"));
    }

    @Test
    void aDesignWithNoPartsOrQueriesOmitsThoseArtifacts() {
        Design bare = TestDesigns.builder().parts(List.of()).queries(List.of()).build();

        assertThat(catalogue.artifactsFor(bare, Audience.INTERNAL))
                .extracting(Artifact::id)
                .doesNotContain("bill-of-materials", "query-log")
                .contains("summary");
    }
}
