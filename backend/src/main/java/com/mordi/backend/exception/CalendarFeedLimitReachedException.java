package com.mordi.backend.exception;

// Thrown when a user tries to connect more calendars than the cap allows.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler; the message is
// written to be shown to the person as-is.

public class CalendarFeedLimitReachedException extends RuntimeException {
    public CalendarFeedLimitReachedException(int limit) {
        super("You can connect up to " + limit + " calendars. Disconnect one to add another.");
    }
}
