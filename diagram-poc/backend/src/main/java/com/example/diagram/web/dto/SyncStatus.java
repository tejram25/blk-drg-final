package com.example.diagram.web.dto;

import java.time.Instant;

/**
 * The state of the Salesforce → workspace project mirror, shown in the IDE
 * status bar.
 *
 * <p>A nightly job pulls the project catalogue; {@code lastSync} / {@code
 * nextSync} bracket it. {@code synced} is the number of projects mirrored on the
 * last run, {@code failed} the number that errored, {@code total} the current
 * catalogue size. {@code running} is true while a run (nightly or manual) is in
 * flight. Timestamps are absolute (ISO-8601); the client renders them relative.
 */
public record SyncStatus(
        Instant lastSync,
        Instant nextSync,
        int synced,
        int failed,
        int total,
        boolean running) {}
