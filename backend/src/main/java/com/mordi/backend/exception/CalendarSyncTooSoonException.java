package com.mordi.backend.exception;

// "Sync now" pressed again within a minute of the last sync. Google's own
// feed changes far more slowly than that, so another fetch would only add load.
// Mapped to HTTP 429 Too Many Requests by GlobalExceptionHandler

public class CalendarSyncTooSoonException extends RuntimeException {
    public CalendarSyncTooSoonException() {
        super("Synced a moment ago. Try again in a minute.");
    }
}
