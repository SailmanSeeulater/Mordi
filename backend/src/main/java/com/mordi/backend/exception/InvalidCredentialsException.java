package com.mordi.backend.exception;

// Thrown when login fails due to email or password doesn't exist/match.
// Mapped to HTTP 401 Unauthorized by GlobalExceptionHandler

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
    
}
