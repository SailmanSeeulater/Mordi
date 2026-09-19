package com.mordi.backend.exception;

// Thrown when an entry doesn't exist or belongs to another user. Both share one
// message, so entry ids from other accounts can't be probed.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler.

public class BehaviorNotFoundException extends RuntimeException {
    public BehaviorNotFoundException() {
        super("Entry not found");
    }
}
