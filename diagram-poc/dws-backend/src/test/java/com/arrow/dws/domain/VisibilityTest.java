package com.arrow.dws.domain;

import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.PartLifecycle;
import com.arrow.dws.domain.model.Visibility;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The rules that decide what leaves Arrow, tested without a container.
 *
 * <p>That these run in milliseconds with no Spring on the classpath is the
 * measurable benefit of keeping the domain free of the framework.
 */
class VisibilityTest {

    @Test
    void internalContentNeverReachesARestrictedAudience() {
        assertThat(Visibility.INTERNAL.visibleTo(Audience.EMBEDDED)).isFalse();
        assertThat(Visibility.INTERNAL.visibleTo(Audience.INTERNAL)).isTrue();
    }

    @ParameterizedTest
    @EnumSource(Audience.class)
    void customerVisibleContentReachesEveryone(Audience audience) {
        assertThat(Visibility.CUSTOMER_VISIBLE.visibleTo(audience)).isTrue();
    }

    /**
     * Adding an audience must force a decision here. If a new constant defaults
     * to unrestricted, internal content silently leaks into it.
     */
    @Test
    void everyAudienceHasDeclaredWhetherItIsRestricted() {
        assertThat(Audience.EMBEDDED.isRestricted()).isTrue();
        assertThat(Audience.EMBEDDED.canAct()).isFalse();
        assertThat(Audience.INTERNAL.isRestricted()).isFalse();
        assertThat(Audience.INTERNAL.canAct()).isTrue();
    }

    /** Adding a lifecycle forces a risk decision at the point of adding. */
    @ParameterizedTest
    @EnumSource(PartLifecycle.class)
    void everyLifecycleDeclaresItsRiskAndTone(PartLifecycle lifecycle) {
        assertThat(lifecycle.label()).isNotBlank();
        assertThat(lifecycle.tone()).isNotNull();
        assertThat(lifecycle.isAtRisk()).isEqualTo(lifecycle != PartLifecycle.ACTIVE);
    }
}
