package com.mordi.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

// The place where turning exceptions messages into HTTP response.

@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(EmailAlreadyExistsException.class) 
    public ResponseEntity<Map<String, Object>> handleEmailExists(EmailAlreadyExistsException ex) {
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException ex) {
        return buildResponse(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(GoalNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleGoalNotFound(GoalNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(NoteNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoteNotFound(NoteNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    // The request was well formed; it conflicts with how many notes already
    // exist. The message is written to be shown to the person as-is.
    @ExceptionHandler(NoteLimitReachedException.class)
    public ResponseEntity<Map<String, Object>> handleNoteLimit(NoteLimitReachedException ex) {
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(TodoNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleTodoNotFound(TodoNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(BehaviorNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleBehaviorNotFound(BehaviorNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(PlanEventNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handlePlanEventNotFound(PlanEventNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(InviteNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleInviteNotFound(InviteNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(MessageNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleMessageNotFound(MessageNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(GoalFullException.class)
    public ResponseEntity<Map<String, Object>> handleGoalFull(GoalFullException ex) {
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(TooManyMessagesException.class)
    public ResponseEntity<Map<String, Object>> handleTooManyMessages(TooManyMessagesException ex) {
        return buildResponse(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError error: ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("error", "Validation failed");
        body.put("fieldErrors", fieldErrors);
        
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex) {
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
    }

    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", message);
        
        return ResponseEntity.status(status).body(body);
    }
}
