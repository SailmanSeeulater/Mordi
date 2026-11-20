package com.mordi.backend.exception;

// Thrown when as many "Try it" accounts are open as the server allows at
// once. Mapped to HTTP 503 by GlobalExceptionHandler; the message is written
// to be shown to the person as-is.

public class GuestsFullException extends RuntimeException {
    public GuestsFullException() {
        super("The demo is busy right now. Make a free account instead, it takes a minute.");
    }
}
