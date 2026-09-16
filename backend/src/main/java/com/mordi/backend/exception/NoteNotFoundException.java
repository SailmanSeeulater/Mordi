package com.mordi.backend.exception;

// Thrown when a note doesn't exist or belongs to another user. Both share one
// message, so note ids from other accounts can't be probed.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler.

public class NoteNotFoundException extends RuntimeException {
    public NoteNotFoundException() {
        super("Note not found");
    }
}
