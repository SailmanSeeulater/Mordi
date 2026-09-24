package com.mordi.backend.exception;

// A message that doesn't exist, belongs to another goal, or isn't the
// caller's to delete. All read the same.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler

public class MessageNotFoundException extends RuntimeException {
    public MessageNotFoundException() {
        super("Message not found");
    }
}
