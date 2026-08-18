package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.DesignDocument;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Documents filed against the design.
 *
 * <p>The filtering is {@code design.documentsFor(audience)} and nowhere else.
 * A restricted audience does not receive an internal document marked internal —
 * it does not receive it at all.
 */
@Component
public class RepositoryTabContributor implements TabContributor {

    @Override
    public String key() {
        return "fast-repo";
    }

    @Override
    public int order() {
        return 4;
    }

    @Override
    public TabView build(Design design, Audience audience) {
        List<DesignDocument> visible = design.documentsFor(audience);
        int withheld = design.documents().size() - visible.size();

        TabBuilder tab = TabBuilder.of(key(), "FAST Repository", "database", order(), audience)
                .count("documentCount", "Documents", visible.size());

        for (DesignDocument d : visible) {
            List<FieldView> fields = new ArrayList<>(List.of(
                    FieldView.of("kind", "Kind", d.kind()),
                    FieldView.of("size", "Size", d.sizeLabel()),
                    FieldView.of("updated", "Updated", d.updatedLabel())));
            // No point telling a restricted audience a document is
            // customer-visible — everything it can see is.
            if (!audience.isRestricted()) {
                fields.add(FieldView.of("visibility", "Visibility",
                        d.visibility().label(), d.visibility().tone()));
            }
            tab.item(d.name(), d.name(), d.kind(), fields);
        }

        if (withheld > 0) {
            tab.note(withheld + " internal document" + (withheld == 1 ? " is" : "s are")
                    + " not returned to this view.");
        }
        return tab.build();
    }
}
