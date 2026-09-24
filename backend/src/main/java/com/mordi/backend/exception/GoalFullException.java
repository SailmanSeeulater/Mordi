package com.mordi.backend.exception;

// A shared goal already has as many people as it can take.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler

public class GoalFullException extends RuntimeException {
    public GoalFullException(int max) {
        super("This goal already has " + max + " people");
    }
}
