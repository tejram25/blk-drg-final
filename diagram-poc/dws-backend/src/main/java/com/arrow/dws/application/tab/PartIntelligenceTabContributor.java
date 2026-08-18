package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.PartUsage;
import com.arrow.dws.domain.model.Tone;

import org.springframework.stereotype.Component;

import java.util.List;

/** The parts on the design, and which of them are a supply risk. */
@Component
public class PartIntelligenceTabContributor implements TabContributor {

    @Override
    public String key() {
        return "part-intel";
    }

    @Override
    public int order() {
        return 3;
    }

    @Override
    public TabView build(Design design, Audience audience) {
        int atRisk = design.partsAtRisk().size();

        TabBuilder tab = TabBuilder.of(key(), "Part Intelligence", "search", order(), audience)
                .count("partCount", "Parts", design.parts().size())
                .count("partsAtRisk", "Not in full production", atRisk,
                        atRisk == 0 ? Tone.POSITIVE : Tone.WARNING);

        for (PartUsage p : design.parts()) {
            tab.item(p.manufacturerPartNumber(), p.manufacturerPartNumber(), p.manufacturer(), List.of(
                    FieldView.of("function", "Function", p.function()),
                    FieldView.of("lifecycle", "Lifecycle", p.lifecycle().label(), p.lifecycle().tone()),
                    FieldView.of("leadTime", "Lead time", p.leadTimeLabel()),
                    FieldView.of("stock", "Stock", p.stockLabel())));
        }

        if (atRisk > 0) {
            tab.note(atRisk + (atRisk == 1 ? " part is" : " parts are")
                    + " not in full production. See the AI Assistant tab for alternates.");
        }
        return tab.build();
    }
}
