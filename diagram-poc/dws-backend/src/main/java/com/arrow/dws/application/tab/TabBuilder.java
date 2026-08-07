package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.ItemView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Tone;

import java.util.ArrayList;
import java.util.List;

/**
 * Assembles a {@link TabView}, so contributors say what a tab contains rather
 * than how to construct one.
 *
 * <p>It also holds the one invariant every tab shares: {@code readOnly} follows
 * the audience, and the badge is derived from the items actually added rather
 * than passed in separately — a count and a list cannot disagree if only one of
 * them is ever written down.
 */
public final class TabBuilder {

    private final String key;
    private final String label;
    private final String icon;
    private final int order;
    private final Audience audience;
    private final List<FieldView> fields = new ArrayList<>();
    private final List<ItemView> items = new ArrayList<>();
    private String note;
    private String badgeOverride;
    private boolean badgeSuppressed;

    private TabBuilder(String key, String label, String icon, int order, Audience audience) {
        this.key = key;
        this.label = label;
        this.icon = icon;
        this.order = order;
        this.audience = audience;
    }

    public static TabBuilder of(String key, String label, String icon, int order, Audience audience) {
        return new TabBuilder(key, label, icon, order, audience);
    }

    public TabBuilder field(String key, String label, String value) {
        fields.add(FieldView.of(key, label, value));
        return this;
    }

    public TabBuilder field(String key, String label, String value, Tone tone) {
        fields.add(FieldView.of(key, label, value, tone));
        return this;
    }

    /** Add a field only when the audience is allowed to see it. */
    public TabBuilder internalOnlyField(String key, String label, String value, Tone tone) {
        if (!audience.isRestricted()) {
            fields.add(FieldView.of(key, label, value, tone));
        }
        return this;
    }

    public TabBuilder count(String key, String label, int value) {
        return field(key, label, String.valueOf(value));
    }

    public TabBuilder count(String key, String label, int value, Tone tone) {
        return field(key, label, String.valueOf(value), tone);
    }

    public TabBuilder item(String key, String title, String subtitle, List<FieldView> itemFields) {
        items.add(new ItemView(key, title, subtitle, itemFields));
        return this;
    }

    public TabBuilder note(String text) {
        this.note = text;
        return this;
    }

    /** Use a badge other than the item count — an open-query count, say. */
    public TabBuilder badge(int value) {
        this.badgeOverride = value == 0 ? null : String.valueOf(value);
        this.badgeSuppressed = value == 0;
        return this;
    }

    public TabView build() {
        String badge = badgeSuppressed || badgeOverride != null
                ? badgeOverride
                : (items.isEmpty() ? null : String.valueOf(items.size()));
        return new TabView(key, label, icon, order, badge, !audience.canAct(),
                List.copyOf(fields), List.copyOf(items), note);
    }
}
