package com.arrow.dws.adapter.render;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.Design;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * Shared workbook plumbing for the spreadsheet artifacts.
 *
 * <p>Not an interface and not a renderer itself — the two spreadsheet renderers
 * differ only in which rows they write, and having them each set up their own
 * header styling is how the two drift apart.
 */
abstract class SpreadsheetRenderer {

    /** Write a spreadsheet and return its bytes. */
    protected byte[] workbook(Design design, Artifact artifact, SheetWriter writer) {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet(artifact.title());
            Styles styles = new Styles(workbook);

            int row = writeTitleBlock(sheet, styles, design, artifact);
            writer.write(sheet, styles, row);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException("Could not write " + artifact.fileName(), ex);
        }
    }

    /** Title, design and customer — so a downloaded file still says what it is. */
    private int writeTitleBlock(Sheet sheet, Styles styles, Design design, Artifact artifact) {
        Row title = sheet.createRow(0);
        cell(title, 0, artifact.title(), styles.title);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 4));

        Row context = sheet.createRow(1);
        cell(context, 0, design.id() + " · " + design.name() + " · " + design.customer(), styles.muted);
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 4));

        return 3;   // leave a blank row before the table
    }

    protected void header(Sheet sheet, Styles styles, int rowIndex, List<String> columns) {
        Row row = sheet.createRow(rowIndex);
        for (int i = 0; i < columns.size(); i++) {
            cell(row, i, columns.get(i), styles.header);
            sheet.setColumnWidth(i, 22 * 256);
        }
    }

    protected void cell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    /** What a concrete spreadsheet renderer supplies. */
    @FunctionalInterface
    protected interface SheetWriter {
        void write(Sheet sheet, Styles styles, int firstRow);
    }

    /** The workbook's styles, created once — POI caps how many a workbook may hold. */
    protected static final class Styles {

        final CellStyle title;
        final CellStyle muted;
        final CellStyle header;
        final CellStyle body;
        final CellStyle flagged;

        Styles(Workbook workbook) {
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            title = workbook.createCellStyle();
            title.setFont(titleFont);

            Font mutedFont = workbook.createFont();
            mutedFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            muted = workbook.createCellStyle();
            muted.setFont(mutedFont);

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            header = workbook.createCellStyle();
            header.setFont(headerFont);
            header.setFillForegroundColor(IndexedColors.BLACK.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.LEFT);
            header.setBorderBottom(BorderStyle.THIN);

            body = workbook.createCellStyle();
            body.setBorderBottom(BorderStyle.HAIR);

            // For the rows a reader must not skim past — an end-of-life part,
            // an unanswered question.
            Font flaggedFont = workbook.createFont();
            flaggedFont.setBold(true);
            flagged = workbook.createCellStyle();
            flagged.setFont(flaggedFont);
            flagged.setFillForegroundColor(IndexedColors.LEMON_CHIFFON.getIndex());
            flagged.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            flagged.setBorderBottom(BorderStyle.HAIR);
        }
    }
}
