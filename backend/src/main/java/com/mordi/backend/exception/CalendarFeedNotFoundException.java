package com.mordi.backend.exception;

// Thrown when a connected calendar doesn't exist or belongs to another user,
// and for every calendar route when this server has no MORDI_FEED_KEY: a
// feature that is switched off answers exactly like one that is not there.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler.

public class CalendarFeedNotFoundException extends RuntimeException {
    public CalendarFeedNotFoundException() {
        super("Calendar not found");
    }
}
