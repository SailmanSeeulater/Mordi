package com.mordi.backend.exception;

// Thrown when a one-time link is missing, unknown, expired, already used, or
// for a different purpose. One message for all of them, as with refresh
// tokens: the person only needs to ask for a new link, and saying which case
// it was would tell an attacker whether a guessed token had once been real.

public class LinkExpiredException extends RuntimeException {
    public LinkExpiredException() {
        super("This link has expired or was already used.");
    }
}
