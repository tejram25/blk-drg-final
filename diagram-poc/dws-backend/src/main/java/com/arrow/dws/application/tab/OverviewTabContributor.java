package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.DesignFlag;
import com.arrow.dws.domain.model.LifecycleStage;
import com.arrow.dws.domain.model.Tone;

import org.springframework.stereotype.Component;

/** The summary tab: what this design is, who owns it, where it has got to. */
@Component
public class OverviewTabContributor implements TabContributor {

    @Override
    public String key() {
        return "overview";
    }

    @Override
    public int order() {
        return 1;
    }

    @Override
    public TabView build(Design design, Audience audience) {
        TabBuilder tab = TabBuilder.of(key(), "Overview", "layout-list", order(), audience)
                .field("designId", "Design", design.id())
                .field("name", "Name", design.name())
                .field("customer", "Customer", design.customer())
                .field("brief", "Brief", design.brief())
                .field("region", "Region", design.region())
                .field("owner", "Owner", design.owner())
                .field("startDate", "Start", design.startDate().toString())
                .field("targetEndDate", "Target end", design.targetEndDate().toString())
                .field("stage", "Lifecycle stage", design.stage().label(), Tone.INFO)
                .field("stagePosition", "Stage position",
                        design.stage().position() + " of " + LifecycleStage.count())
                .field("estimatedValue", "Estimated value", design.estimatedValueLabel(), Tone.POSITIVE)
                .field("opportunityLinked", "Linked to an opportunity",
                        design.linkedOpportunityId().isPresent() ? "Yes" : "No");

        for (DesignFlag flag : design.flags()) {
            tab.field("flag." + flag.key(), flag.label(), "Yes", flag.tone());
        }

        // Withheld from a restricted audience by being absent, not by a
        // suppressed-here flag the client could ignore.
        tab.internalOnlyField("margin", "Margin (internal)", design.internalMarginLabel(), Tone.INFO);

        return tab.build();
    }
}
