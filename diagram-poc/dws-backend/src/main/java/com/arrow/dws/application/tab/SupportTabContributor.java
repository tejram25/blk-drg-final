package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.SupportQuery;
import com.arrow.dws.domain.model.Tone;

import org.springframework.stereotype.Component;

import java.util.List;

/** Questions raised against the design. The badge counts what needs attention. */
@Component
public class SupportTabContributor implements TabContributor {

    @Override
    public String key() {
        return "support";
    }

    @Override
    public int order() {
        return 5;
    }

    @Override
    public TabView build(Design design, Audience audience) {
        int open = design.openQueries().size();

        TabBuilder tab = TabBuilder.of(key(), "Support / Query", "message-circle", order(), audience)
                .count("openQueries", "Open", open, open == 0 ? Tone.POSITIVE : Tone.WARNING)
                .count("totalQueries", "Total", design.queries().size())
                // The tab strip should shout about unanswered questions, not
                // about how many were ever asked.
                .badge(open);

        for (SupportQuery q : design.queries()) {
            tab.item(q.reference(), q.subject(), q.reference(), List.of(
                    FieldView.of("status", "Status", q.status().label(), q.status().tone()),
                    FieldView.of("age", "Age", q.ageLabel()),
                    FieldView.of("owner", "Owner", q.owner())));
        }
        return tab.build();
    }
}
