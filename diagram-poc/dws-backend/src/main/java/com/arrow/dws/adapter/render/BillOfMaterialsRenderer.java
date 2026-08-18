package com.arrow.dws.adapter.render;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.PartUsage;
import com.arrow.dws.domain.port.ArtifactRenderer;

import org.apache.poi.ss.usermodel.Row;
import org.springframework.stereotype.Component;

import java.util.List;

/** The parts list, as a spreadsheet someone can filter and sort. */
@Component
public class BillOfMaterialsRenderer extends SpreadsheetRenderer implements ArtifactRenderer {

    @Override
    public ArtifactKind handles() {
        return ArtifactKind.BILL_OF_MATERIALS;
    }

    @Override
    public byte[] render(Design design, Artifact artifact) {
        return workbook(design, artifact, (sheet, styles, firstRow) -> {
            header(sheet, styles, firstRow,
                    List.of("Part number", "Manufacturer", "Function", "Lifecycle", "Lead time", "Stock"));

            int rowIndex = firstRow + 1;
            for (PartUsage part : design.parts()) {
                Row row = sheet.createRow(rowIndex++);
                // A part that is not in full production is the thing a reader
                // is looking for, so it is highlighted rather than left to be
                // spotted in a column of similar-looking text.
                var style = part.isAtRisk() ? styles.flagged : styles.body;
                cell(row, 0, part.manufacturerPartNumber(), style);
                cell(row, 1, part.manufacturer(), style);
                cell(row, 2, part.function(), style);
                cell(row, 3, part.lifecycle().label(), style);
                cell(row, 4, part.leadTimeLabel(), style);
                cell(row, 5, part.stockLabel(), style);
            }

            int atRisk = design.partsAtRisk().size();
            Row summary = sheet.createRow(rowIndex + 1);
            cell(summary, 0, design.parts().size() + " parts, " + atRisk
                    + (atRisk == 1 ? " not in full production" : " not in full production"), styles.muted);
        });
    }
}
