package com.mordi.backend.exception;

// Thrown when a user tries to keep more notes than the cap allows.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler: the request was
// well formed, it just conflicts with the current state.

public class NoteLimitReachedException extends RuntimeException {
    public NoteLimitReachedException(int limit) {
        super("You can keep up to " + limit + " notes. Delete one to add another.");
    }
}
