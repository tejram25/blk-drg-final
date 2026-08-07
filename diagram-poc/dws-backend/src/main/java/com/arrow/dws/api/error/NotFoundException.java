package com.arrow.dws.api.error;

/** The thing asked for does not exist. Becomes a 404. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
