package com.arrow.dws.adapter.render;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.Design;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * Shared page-drawing for the PDF artifacts.
 *
 * <p>PDFBox draws text at coordinates and has no concept of flow, so "write a
 * line and move down" has to exist somewhere. Here, once — rather than in each
 * renderer, where the margins would eventually disagree.
 */
abstract class PdfWriter {

    private static final float MARGIN = 56f;
    private static final float LINE = 16f;

    protected byte[] document(Design design, Artifact artifact, BodyWriter body) {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Page page = newPage(document);
            page.heading(artifact.title(), 20);
            page.line(design.id() + " · " + design.name() + " · " + design.customer(), 10, true);
            page.rule();
            body.write(page);
            page.close();

            document.save(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException("Could not write " + artifact.fileName(), ex);
        }
    }

    private Page newPage(PDDocument document) throws IOException {
        PDPage page = new PDPage(PDRectangle.A4);
        document.addPage(page);
        return new Page(document, page);
    }

    @FunctionalInterface
    protected interface BodyWriter {
        void write(Page page) throws IOException;
    }

    /** A page that remembers where it got to. */
    protected static final class Page {

        private final PDDocument document;
        private PDPage page;
        private PDPageContentStream stream;
        private float y;

        Page(PDDocument document, PDPage page) throws IOException {
            this.document = document;
            this.page = page;
            this.stream = new PDPageContentStream(document, page);
            this.y = page.getMediaBox().getHeight() - MARGIN;
        }

        public void heading(String text, float size) throws IOException {
            text(text, size, true, false);
            y -= 6;
        }

        public void line(String text, float size, boolean muted) throws IOException {
            text(text, size, false, muted);
        }

        public void line(String text) throws IOException {
            text(text, 11, false, false);
        }

        /** A label and its value on one row, so the page reads as a record. */
        public void pair(String label, String value) throws IOException {
            breakPageIfNeeded();
            stream.beginText();
            stream.setFont(PDType1Font.HELVETICA, 10);
            stream.setNonStrokingColor(0.42f, 0.45f, 0.5f);
            stream.newLineAtOffset(MARGIN, y);
            stream.showText(sanitise(label));
            stream.endText();

            stream.beginText();
            stream.setFont(PDType1Font.HELVETICA_BOLD, 10);
            stream.setNonStrokingColor(0.1f, 0.1f, 0.1f);
            stream.newLineAtOffset(MARGIN + 150, y);
            stream.showText(sanitise(value));
            stream.endText();
            y -= LINE;
        }

        public void blank() {
            y -= LINE * 0.6f;
        }

        public void rule() throws IOException {
            breakPageIfNeeded();
            stream.setStrokingColor(0.88f, 0.9f, 0.92f);
            stream.moveTo(MARGIN, y);
            stream.lineTo(page.getMediaBox().getWidth() - MARGIN, y);
            stream.stroke();
            y -= LINE;
        }

        /** Wraps to the page width rather than running off the right edge. */
        public void paragraph(String text) throws IOException {
            float maxWidth = page.getMediaBox().getWidth() - 2 * MARGIN;
            StringBuilder current = new StringBuilder();
            for (String word : sanitise(text).split(" ")) {
                String candidate = current.isEmpty() ? word : current + " " + word;
                float width = PDType1Font.HELVETICA.getStringWidth(candidate) / 1000 * 11;
                if (width > maxWidth && !current.isEmpty()) {
                    line(current.toString());
                    current = new StringBuilder(word);
                } else {
                    current = new StringBuilder(candidate);
                }
            }
            if (!current.isEmpty()) {
                line(current.toString());
            }
        }

        public void bullets(List<String> items) throws IOException {
            for (String item : items) {
                paragraph("•  " + item);
            }
        }

        private void text(String value, float size, boolean bold, boolean muted) throws IOException {
            breakPageIfNeeded();
            stream.beginText();
            stream.setFont(bold ? PDType1Font.HELVETICA_BOLD : PDType1Font.HELVETICA, size);
            if (muted) {
                stream.setNonStrokingColor(0.42f, 0.45f, 0.5f);
            } else {
                stream.setNonStrokingColor(0.1f, 0.1f, 0.1f);
            }
            stream.newLineAtOffset(MARGIN, y);
            stream.showText(sanitise(value));
            stream.endText();
            y -= LINE + (size > 14 ? 8 : 0);
        }

        private void breakPageIfNeeded() throws IOException {
            if (y > MARGIN + LINE) {
                return;
            }
            stream.close();
            page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            y = page.getMediaBox().getHeight() - MARGIN;
        }

        void close() throws IOException {
            stream.close();
        }

        /**
         * The standard PDF fonts are WinAnsi-encoded and throw on anything
         * outside it — an em dash or a degree sign in a project name would
         * otherwise fail the whole download. Replace rather than reject: a
         * hyphen where an em dash was is a far better outcome than a 500.
         */
        private static String sanitise(String text) {
            if (text == null) {
                return "";
            }
            return text
                    .replace('—', '-')     // em dash
                    .replace('–', '-')     // en dash
                    .replace('‘', '\'')
                    .replace('’', '\'')
                    .replace('“', '"')
                    .replace('”', '"')
                    .replace("°", " deg ")
                    .replace('·', '-')     // middle dot
                    // U+2022 is kept: it is in WinAnsi (0x95) and the standard
                    // fonts encode it, so a bullet stays a bullet. It is above
                    // 0xFF, so without this it would fall into the catch-all
                    // below and every list item would read "?".
                    .replaceAll("[^\\x20-\\xFF\u2022]", "?");
        }
    }
}
