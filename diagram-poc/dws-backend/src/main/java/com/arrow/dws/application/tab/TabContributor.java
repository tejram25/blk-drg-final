package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;

/**
 * Contributes one tab to the opportunity view.
 *
 * <p><b>This is the extension point.</b> Adding a tab is adding a class that
 * implements this and carries {@code @Component}; Spring collects every
 * implementation and the use case orders them. Nothing in the use case, the
 * controller or any other tab is touched — which is the difference between a
 * switch statement that grows a branch per tab and a design that is closed to
 * modification.
 *
 * <p>Two rules an implementation must honour:
 *
 * <ul>
 *   <li><b>Ask the domain, do not re-implement it.</b> Use
 *       {@code design.documentsFor(audience)} rather than filtering on
 *       visibility here — one tab quietly getting that wrong is exactly the
 *       failure this API exists to prevent.
 *   <li><b>Counts describe what was returned.</b> A badge that says 4 while
 *       {@code items} holds 2 tells the user something false.
 * </ul>
 */
public interface TabContributor {

    /** Stable identifier — appears in the response and in client code. */
    String key();

    /** Position in the tab strip, ascending. */
    int order();

    /**
     * Whether this tab appears at all for this design and audience. Default is
     * always; override to hide a tab rather than return an empty one, when an
     * empty tab would be misleading.
     */
    default boolean appliesTo(Design design, Audience audience) {
        return true;
    }

    /** Build the tab. Never returns null. */
    TabView build(Design design, Audience audience);
}
