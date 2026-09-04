package com.mordi.backend.exception;

// Thrown when a user registered with an email that's already taken.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler
public class EmailAlreadyExistsException extends RuntimeException{
    public EmailAlreadyExistsException(String message) {
        super(message);
    }
}
