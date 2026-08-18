package com.example.diagram.web.error;

/** Thrown by the service layer when a requested resource does not exist. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
