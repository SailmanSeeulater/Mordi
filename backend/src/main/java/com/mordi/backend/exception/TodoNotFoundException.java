package com.mordi.backend.exception;

// Thrown when a to-do doesn't exist or belongs to another user. Both share one
// message, so to-do ids from other accounts can't be probed.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler.

public class TodoNotFoundException extends RuntimeException {
    public TodoNotFoundException() {
        super("To-do not found");
    }
}
