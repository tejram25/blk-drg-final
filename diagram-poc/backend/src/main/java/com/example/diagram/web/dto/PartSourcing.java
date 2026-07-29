package com.example.diagram.web.dto;

/**
 * Sourcing and supply-risk signals for a part, read from its best-ranked
 * inventory organisation.
 *
 * <p>These are the flags that decide whether a part can actually be designed in
 * and bought, as opposed to whether it exists: a part on supplier allocation or
 * carrying an open change notice is a schedule risk even when stock and
 * lifecycle status both look healthy.
 *
 * <p>Deliberately excluded: the upstream also returns Arrow's own cost basis
 * ({@code refBussCost}, {@code bestBussCost}) and internal win scores
 * ({@code suppCanWin}, {@code salesCanWin}). Those are commercially sensitive
 * and must not reach the browser, so this proxy never carries them.
 *
 * @param allocation   supplier allocation state, e.g. "NONE"; non-NONE means constrained supply
 * @param franchised   Arrow is a franchised (authorised) distributor for this part
 * @param changeNotice an open product change notification (PCN) exists
 * @param ncnr         non-cancellable / non-returnable once ordered
 * @param soleSource   the part has a single source of supply
 * @param backorderable whether the part can be backordered
 * @param militarySpec military-specification part
 * @param ftzEnabled   eligible for foreign-trade-zone handling
 * @param partClass    upstream inventory classification, e.g. "D" or "SP1"
 */
public record PartSourcing(
        String allocation,
        boolean franchised,
        boolean changeNotice,
        boolean ncnr,
        boolean soleSource,
        boolean backorderable,
        boolean militarySpec,
        boolean ftzEnabled,
        String partClass) {}
