package com.example.diagram.web.dto;

import java.time.Instant;

/**
 * One entry in the sync history — a single run of the Salesforce mirror.
 *
 * <p>{@code trigger} is {@code nightly} (the scheduled job) or {@code manual}
 * (the status-bar "Sync now" override). {@code triggeredBy} is the user's email
 * for a manual run, null for the nightly job. {@code status} is one of running,
 * success, partial (some projects failed), failed. {@code finishedAt} is null
 * while {@code status} is running.
 */
public record SyncRun(
        String id,
        String trigger,
        String triggeredBy,
        String status,
        Instant startedAt,
        Instant finishedAt,
        int synced,
        int failed) {}
