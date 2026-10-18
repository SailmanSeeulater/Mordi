package com.mordi.backend.exception;

// Thrown when the person already has a category with this name, in any case.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler; the message is
// written to be shown to the person as-is.

public class CategoryNameTakenException extends RuntimeException {
    public CategoryNameTakenException(String name) {
        super("You already have a category called “" + name + "”.");
    }
}
