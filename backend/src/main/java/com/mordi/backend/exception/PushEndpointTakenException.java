package com.mordi.backend.exception;

// A browser's push subscription already belongs to another account. One
// endpoint is one browser, so handing it over would let whoever signs in
// there next receive, or silence, the first person's reminders.
// Mapped to HTTP 409 Conflict by GlobalExceptionHandler

public class PushEndpointTakenException extends RuntimeException {
    public PushEndpointTakenException() {
        super("This browser is already receiving reminders for another account. Turn them off there first.");
    }
}
