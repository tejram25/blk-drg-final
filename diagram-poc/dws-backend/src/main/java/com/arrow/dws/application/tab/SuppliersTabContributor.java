package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.SupplierEngagement;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/** Suppliers engaged on the design and where each engagement has got to. */
@Component
public class SuppliersTabContributor implements TabContributor {

    @Override
    public String key() {
        return "supplier-collab";
    }

    @Override
    public int order() {
        return 7;
    }

    @Override
    public TabView build(Design design, Audience audience) {
        TabBuilder tab = TabBuilder.of(key(), "Suppliers", "users", order(), audience)
                .count("supplierCount", "Suppliers", design.suppliers().size());

        for (SupplierEngagement s : design.suppliers()) {
            tab.item(slug(s.name()), s.name(), s.role(), List.of(
                    FieldView.of("status", "Status", s.status().label(), s.status().tone()),
                    FieldView.of("latest", "Latest", s.latestNote())));
        }
        return tab.build();
    }

    /** Lower-case, hyphenated — a key derived from a display name. */
    private static String slug(String name) {
        return name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
