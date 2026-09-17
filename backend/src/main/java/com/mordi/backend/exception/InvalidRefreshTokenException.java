package com.mordi.backend.exception;

// Thrown when a refresh token is missing, unknown, expired, or already used.
// All four share one message: the caller only needs to know that the session
// is over and they have to sign in again, and telling them which case it was
// would tell an attacker whether a stolen token had once been real.

public class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException() {
        super("Session expired. Sign in again.");
    }
}
