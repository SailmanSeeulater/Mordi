package com.mordi.backend.exception;

// Thrown when a goal doesn't exist, isn't active, or belongs to another user.
// All three share one message so goal ids from other accounts can't be probed.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler

public class GoalNotFoundException extends RuntimeException {
    public GoalNotFoundException() {
        super("Goal not found");
    }
}
