package com.example.diagram.service.impl;

import com.example.diagram.service.LifecycleService;
import com.example.diagram.web.dto.AlternativePart;
import com.example.diagram.web.dto.LifecycleInfo;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Mock lifecycle data so the "lifecycle risk + approved alternatives" flow can
 * be demoed without a SiliconExpert subscription. Returns canned status for a
 * few known parts and a safe "Active" default for everything else.
 */
@Service
public class MockLifecycleService implements LifecycleService {

    private record Canned(String status, String risk, String recommendation, List<AlternativePart> alts) {}

    private static final Map<String, Canned> DATA = Map.of(
            "DS91C176TMA/NOPB", new Canned("NRND", "High",
                    "Not Recommended for New Designs — qualify a drop-in before production.",
                    List.of(
                            new AlternativePart("DS91C176MA/NOPB", "Texas Instruments", "Same family, active orderable package", true),
                            new AlternativePart("SN65HVD1781DR", "Texas Instruments", "Approved substitute, verify supply rail", false))),
            "LM317T", new Canned("Active", "Low",
                    "Active and multi-sourced.",
                    List.of(new AlternativePart("LM317MBSTT3G", "onsemi", "Second source, same regulation", true))),
            "BAV23S", new Canned("Last Time Buy", "Medium",
                    "LTB announced — secure stock or qualify the alternative.",
                    List.of(new AlternativePart("BAV23SLT1G", "onsemi", "Drop-in replacement, SOT-23", true)))
    );

    @Override
    public LifecycleInfo lookup(String partNumber) {
        String pn = partNumber == null ? "" : partNumber.trim();
        Canned c = DATA.get(pn);
        if (c == null) {
            return new LifecycleInfo(pn, "Active", "Low", "Active and orderable.", List.of());
        }
        return new LifecycleInfo(pn, c.status(), c.risk(), c.recommendation(), c.alts());
    }
}
