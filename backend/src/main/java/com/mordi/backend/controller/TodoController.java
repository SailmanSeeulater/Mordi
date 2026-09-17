package com.mordi.backend.controller;

import com.mordi.backend.dto.TodoRequest;
import com.mordi.backend.model.Todo;
import com.mordi.backend.service.TodoService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/todos")
@RequiredArgsConstructor
public class TodoController {

    private final TodoService todoService;

    @GetMapping
    public ResponseEntity<List<Todo>> getTodos(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(todoService.getTodos(email));
    }

    @PostMapping
    public ResponseEntity<Todo> createTodo(
            @AuthenticationPrincipal String email,
            @RequestBody TodoRequest request) {
        return ResponseEntity.ok(todoService.createTodo(email, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Todo> updateTodo(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestBody TodoRequest request) {
        return ResponseEntity.ok(todoService.updateTodo(email, id, request));
    }

    // A literal path segment always outranks a template in Spring's matching,
    // so "done" is never read as an id.
    @DeleteMapping("/done")
    public ResponseEntity<Map<String, Integer>> clearDone(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(Map.of("cleared", todoService.clearDone(email)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTodo(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        todoService.deleteTodo(email, id);
        return ResponseEntity.noContent().build();
    }
}
