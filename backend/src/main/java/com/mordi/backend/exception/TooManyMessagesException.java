package com.mordi.backend.exception;

// Messages sent faster than any person types them.
// Mapped to HTTP 429 Too Many Requests by GlobalExceptionHandler

public class TooManyMessagesException extends RuntimeException {
    public TooManyMessagesException() {
        super("You're sending messages too quickly. Wait a moment and try again.");
    }
}
