package com.mordi.backend.exception;

// Thrown when someone tries to change, delete or answer an event copied from
// a connected Google Calendar. The copy would only be overwritten by the next
// sync, so the change belongs in Google.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler; the message is
// written to be shown to the person as-is.

public class ReadOnlyEventException extends RuntimeException {
    public ReadOnlyEventException() {
        super("This event comes from Google Calendar. Change it there.");
    }
}
