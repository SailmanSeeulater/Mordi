package com.mordi.backend.exception;

// Thrown when the person has already connected this calendar's address.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler; the message is
// written to be shown to the person as-is.

public class CalendarFeedTakenException extends RuntimeException {
    public CalendarFeedTakenException() {
        super("That calendar is already connected.");
    }
}
