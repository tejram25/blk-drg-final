package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.BlockDiagram;
import com.arrow.dws.domain.model.Design;

import org.springframework.stereotype.Component;

import java.util.List;

/** The design's block diagrams. The canvas itself lives in the diagram service. */
@Component
public class BlockDiagramsTabContributor implements TabContributor {

    @Override
    public String key() {
        return "block-diagrams";
    }

    @Override
    public int order() {
        return 2;
    }

    @Override
    public TabView build(Design design, Audience audience) {
        TabBuilder tab = TabBuilder.of(key(), "Block Diagrams", "workflow", order(), audience)
                .count("diagramCount", "Diagrams", design.diagrams().size());

        for (BlockDiagram d : design.diagrams()) {
            tab.item(d.id(), d.name(), d.summary(), List.of(
                    FieldView.of("revision", "Revision", d.revision()),
                    FieldView.of("status", "Status", d.status().label(), d.status().tone()),
                    FieldView.of("updated", "Updated", d.updatedLabel())));
        }

        return tab.note(audience.isRestricted()
                        ? "Opening a diagram loads the canvas read-only, inside this view."
                        : "Open a diagram to edit it on the canvas.")
                .build();
    }
}
