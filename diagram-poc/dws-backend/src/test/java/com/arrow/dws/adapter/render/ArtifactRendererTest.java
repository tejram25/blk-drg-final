package com.arrow.dws.adapter.render;

import com.arrow.dws.TestDesigns;
import com.arrow.dws.application.artifact.ArtifactCatalogue;
import com.arrow.dws.application.artifact.ArtifactRendererRegistry;
import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactFormat;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.RenderedArtifact;
import com.arrow.dws.domain.port.ArtifactRenderer;

import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The files are real files.
 *
 * <p>Asserting "the byte array is not empty" would pass for every broken
 * renderer ever written. These open each artifact with the library that reads
 * that format, which is the only assertion that means a customer can open it.
 */
class ArtifactRendererTest {

    private final List<ArtifactRenderer> renderers = List.of(
            new DiagramPngRenderer(),
            new BillOfMaterialsRenderer(),
            new QueryLogRenderer(),
            new DesignSummaryPdfRenderer(),
            new DocumentPdfRenderer());

    private final ArtifactRendererRegistry registry = new ArtifactRendererRegistry(renderers);
    private final ArtifactCatalogue catalogue = new ArtifactCatalogue();

    private RenderedArtifact render(Design design, String artifactId) {
        Artifact artifact = catalogue.find(design, Audience.INTERNAL, artifactId).orElseThrow();
        return registry.render(design, artifact);
    }

    @Test
    void everyArtifactRendersToSomethingItsOwnLibraryCanOpen() throws Exception {
        Design design = TestDesigns.withMixedDocuments();

        for (Artifact artifact : catalogue.artifactsFor(design, Audience.INTERNAL)) {
            byte[] content = registry.render(design, artifact).content();
            assertThat(content).as("%s is empty", artifact.id()).isNotEmpty();

            switch (artifact.format()) {
                case PNG -> {
                    BufferedImage image = ImageIO.read(new ByteArrayInputStream(content));
                    assertThat(image).as("%s is not a readable image", artifact.id()).isNotNull();
                    assertThat(image.getWidth()).isGreaterThan(100);
                }
                case PDF -> {
                    try (PDDocument pdf = PDDocument.load(content)) {
                        assertThat(pdf.getNumberOfPages()).as("%s has no pages", artifact.id()).isPositive();
                    }
                }
                case XLSX -> {
                    try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(content))) {
                        assertThat(workbook.getNumberOfSheets()).isPositive();
                        assertThat(workbook.getSheetAt(0).getLastRowNum()).isPositive();
                    }
                }
            }
        }
    }

    @Test
    void thePngCarriesTheDiagramAndIsSixteenByNine() throws Exception {
        Design design = TestDesigns.builder().build();
        String diagramId = catalogue.artifactsFor(design, Audience.INTERNAL).stream()
                .filter(a -> a.kind() == ArtifactKind.BLOCK_DIAGRAM)
                .findFirst().orElseThrow().id();

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(render(design, diagramId).content()));

        assertThat(image.getWidth()).isEqualTo(1200);
        assertThat(image.getHeight()).isEqualTo(675);
    }

    @Test
    void theBillOfMaterialsHasARowPerPart() throws Exception {
        Design design = TestDesigns.withAtRiskPart();

        try (Workbook workbook = new XSSFWorkbook(
                new ByteArrayInputStream(render(design, "bill-of-materials").content()))) {
            var sheet = workbook.getSheetAt(0);
            // title, context, blank, header, then one row per part, blank, summary
            assertThat(sheet.getLastRowNum()).isGreaterThanOrEqualTo(3 + design.parts().size());

            String all = sheetText(sheet);
            assertThat(all).contains("RISKY1", "GOOD1", "Last time buy");
        }
    }

    @Test
    void theQueryLogHasARowPerQuery() throws Exception {
        Design design = TestDesigns.withOpenQueries();

        try (Workbook workbook = new XSSFWorkbook(
                new ByteArrayInputStream(render(design, "query-log").content()))) {
            String all = sheetText(workbook.getSheetAt(0));
            assertThat(all).contains("Q-1", "Q-2", "Q-3", "2 of 3 still open");
        }
    }

    /**
     * The built-in PDF fonts are WinAnsi-encoded and throw on anything outside
     * it. A project brief with an em dash or a degree sign would otherwise fail
     * the whole download.
     */
    @Test
    void thePdfSurvivesCharactersTheStandardFontsCannotEncode() throws Exception {
        Design design = TestDesigns.builder().build();
        Design awkward = new Design(
                design.id(), "Rail — 85 °C variant", "Kühne & Nagel",
                "Derating at 85 °C — see the ‘thermal’ note.",
                design.region(), design.owner(), design.estimatedValueLabel(), design.stage(),
                design.startDate(), design.targetEndDate(), design.flags(),
                design.internalMarginLabel(), design.opportunityId(), design.diagrams(),
                design.parts(), design.documents(), design.queries(), design.suggestions(),
                design.suppliers());

        byte[] content = render(awkward, "summary").content();

        try (PDDocument pdf = PDDocument.load(content)) {
            assertThat(pdf.getNumberOfPages()).isPositive();
        }
    }

    /**
     * The sanitiser guards against characters the standard fonts cannot
     * encode, and it is easy for it to over-reach. A bullet is in WinAnsi and
     * must survive, or every list in every PDF reads "?".
     */
    @Test
    void bulletsSurviveTheFontSanitiser() throws Exception {
        Design design = TestDesigns.withAtRiskPart();

        byte[] content = render(design, "summary").content();

        try (PDDocument pdf = PDDocument.load(content)) {
            String text = new org.apache.pdfbox.text.PDFTextStripper().getText(pdf);
            assertThat(text).contains("\u2022").doesNotContain("?  RISKY1");
        }
    }

    /** A kind with no renderer would list fine and 500 on download. */
    @Test
    void theRegistryRefusesToStartWithAKindItCannotRender() {
        List<ArtifactRenderer> incomplete = List.of(new DiagramPngRenderer());

        assertThatThrownBy(() -> new ArtifactRendererRegistry(incomplete))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No ArtifactRenderer for");
    }

    @Test
    void theRegistryRefusesTwoRenderersForOneKind() {
        List<ArtifactRenderer> clashing = List.of(new DiagramPngRenderer(), new DiagramPngRenderer());

        assertThatThrownBy(() -> new ArtifactRendererRegistry(clashing))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Two renderers claim");
    }

    /** Bytes are copied in and out, so a caller cannot corrupt a cached file. */
    @Test
    void renderedContentCannotBeMutatedByACaller() {
        RenderedArtifact rendered = render(TestDesigns.builder().build(), "summary");
        byte[] first = rendered.content();
        first[0] = 0;

        assertThat(rendered.content()[0]).isNotZero();
    }

    @Test
    void everyFormatIsOneOfThePromisedThree() {
        assertThat(ArtifactFormat.values())
                .containsExactlyInAnyOrder(ArtifactFormat.PNG, ArtifactFormat.PDF, ArtifactFormat.XLSX);
    }

    private static String sheetText(org.apache.poi.ss.usermodel.Sheet sheet) {
        StringBuilder text = new StringBuilder();
        sheet.forEach(row -> row.forEach(cell -> {
            if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.STRING) {
                text.append(cell.getStringCellValue()).append('\n');
            }
        }));
        return text.toString();
    }
}
