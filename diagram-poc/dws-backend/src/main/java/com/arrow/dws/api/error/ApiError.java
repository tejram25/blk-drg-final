package com.arrow.dws.api.error;

import java.time.Instant;

/**
 * The error body, so a failure is as machine-readable as a success.
 *
 * @param status  HTTP status code
 * @param error   short reason phrase
 * @param message what went wrong, safe to show a developer
 * @param path    the request path
 */
public record ApiError(int status, String error, String message, String path, Instant timestamp) {
}
