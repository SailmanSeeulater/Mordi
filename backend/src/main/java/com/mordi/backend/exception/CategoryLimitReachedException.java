package com.mordi.backend.exception;

// Thrown when a user tries to make more categories than the cap allows.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler; the message is
// written to be shown to the person as-is.

public class CategoryLimitReachedException extends RuntimeException {
    public CategoryLimitReachedException(int limit) {
        super("You can have up to " + limit + " categories of your own. Delete one to add another.");
    }
}
