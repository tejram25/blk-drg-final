package com.arrow.dws.adapter.render;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.SupportQuery;
import com.arrow.dws.domain.port.ArtifactRenderer;

import org.apache.poi.ss.usermodel.Row;
import org.springframework.stereotype.Component;

import java.util.List;

/** The questions raised against the design, open ones highlighted. */
@Component
public class QueryLogRenderer extends SpreadsheetRenderer implements ArtifactRenderer {

    @Override
    public ArtifactKind handles() {
        return ArtifactKind.QUERY_LOG;
    }

    @Override
    public byte[] render(Design design, Artifact artifact) {
        return workbook(design, artifact, (sheet, styles, firstRow) -> {
            header(sheet, styles, firstRow, List.of("Reference", "Subject", "Status", "Age", "Owner"));

            int rowIndex = firstRow + 1;
            for (SupportQuery query : design.queries()) {
                Row row = sheet.createRow(rowIndex++);
                var style = query.isOpen() ? styles.flagged : styles.body;
                cell(row, 0, query.reference(), style);
                cell(row, 1, query.subject(), style);
                cell(row, 2, query.status().label(), style);
                cell(row, 3, query.ageLabel(), style);
                cell(row, 4, query.owner(), style);
            }

            Row summary = sheet.createRow(rowIndex + 1);
            cell(summary, 0, design.openQueries().size() + " of " + design.queries().size()
                    + " still open", styles.muted);
        });
    }
}
