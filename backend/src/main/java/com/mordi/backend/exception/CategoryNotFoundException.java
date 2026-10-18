package com.mordi.backend.exception;

// Thrown when a category doesn't exist or belongs to another user. Both share
// one message, so category ids from other accounts can't be probed.
// Mapped to HTTP 404 Not Found by GlobalExceptionHandler.

public class CategoryNotFoundException extends RuntimeException {
    public CategoryNotFoundException() {
        super("Category not found");
    }
}
