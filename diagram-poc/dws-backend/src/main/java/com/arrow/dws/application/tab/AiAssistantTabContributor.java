package com.arrow.dws.application.tab;

import com.arrow.dws.api.dto.FieldView;
import com.arrow.dws.api.dto.TabView;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.model.Suggestion;

import org.springframework.stereotype.Component;

import java.util.List;

/** What the assistant suggests for this design, and why. */
@Component
public class AiAssistantTabContributor implements TabContributor {

    @Override
    public String key() {
        return "ai-assistant";
    }

    @Override
    public int order() {
        return 6;
    }

    @Override
    public TabView build(Design design, Audience audience) {
        TabBuilder tab = TabBuilder.of(key(), "AI Assistant", "sparkles", order(), audience)
                .count("suggestionCount", "Suggestions", design.suggestions().size());

        List<Suggestion> suggestions = design.suggestions();
        for (int i = 0; i < suggestions.size(); i++) {
            Suggestion s = suggestions.get(i);
            tab.item("suggestion-" + (i + 1), s.title(), null, List.of(
                    FieldView.of("confidence", "Confidence", s.confidence().label(), s.confidence().tone()),
                    FieldView.of("rationale", "Why", s.rationale())));
        }
        return tab.build();
    }
}
