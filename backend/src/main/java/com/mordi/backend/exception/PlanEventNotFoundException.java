package com.mordi.backend.exception;

// Thrown when an event doesn't exist or belongs to another user. Both share one
// message, so event ids from other accounts can't be probed.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler.

public class PlanEventNotFoundException extends RuntimeException {
    public PlanEventNotFoundException() {
        super("Event not found");
    }
}
