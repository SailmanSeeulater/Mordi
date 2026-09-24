package com.mordi.backend.exception;

// An invite code that is wrong, expired, revoked, or for a goal that has
// ended. All four read the same, so codes cannot be probed.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler

public class InviteNotFoundException extends RuntimeException {
    public InviteNotFoundException() {
        super("This invite link has expired or isn't valid");
    }
}
