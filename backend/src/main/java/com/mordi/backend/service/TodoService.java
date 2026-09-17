package com.mordi.backend.service;

import com.mordi.backend.dto.TodoRequest;
import com.mordi.backend.exception.TodoNotFoundException;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** One-line to-dos. No description, no due date, no target: done or not. */
@Service
public class TodoService {

    /** Long enough for a sentence, short enough to stay one line on a phone. */
    static final int MAX_TEXT = 200;

    private final TodoRepository todoRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    @Autowired
    public TodoService(TodoRepository todoRepository, UserRepository userRepository) {
        this(todoRepository, userRepository, Clock.systemDefaultZone());
    }

    TodoService(TodoRepository todoRepository, UserRepository userRepository, Clock clock) {
        this.todoRepository = todoRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    public List<Todo> getTodos(String email) {
        return todoRepository.findByUserOrderByDoneAscCreatedAtAsc(findUser(email));
    }

    public Todo createTodo(String email, TodoRequest request) {
        Todo todo = new Todo();
        todo.setUser(findUser(email));
        todo.setText(requireText(request.getText()));
        todo.setCreatedAt(LocalDateTime.now(clock));
        return todoRepository.save(todo);
    }

    public Todo updateTodo(String email, Long id, TodoRequest request) {
        Todo todo = findOwnedTodo(email, id);
        if (request.getText() != null) {
            todo.setText(requireText(request.getText()));
        }
        if (request.getDone() != null && request.getDone() != todo.isDone()) {
            todo.setDone(request.getDone());
            // When it was finished, not when it was last touched: reopening a
            // to-do clears it, finishing it again sets it afresh.
            todo.setCompletedAt(request.getDone() ? LocalDateTime.now(clock) : null);
        }
        return todoRepository.save(todo);
    }

    public void deleteTodo(String email, Long id) {
        todoRepository.delete(findOwnedTodo(email, id));
    }

    /** Clears everything ticked off, in one go. Returns how many went. */
    @Transactional
    public int clearDone(String email) {
        return todoRepository.deleteDoneByUser(findUser(email));
    }

    /**
     * To-dos belonging to someone else are reported exactly like ones that do
     * not exist, so ids from other accounts cannot be probed.
     */
    private Todo findOwnedTodo(String email, Long id) {
        return todoRepository
            .findById(id)
            .filter(todo -> todo.getUser().getEmail().equals(email))
            .orElseThrow(TodoNotFoundException::new);
    }

    private String requireText(String text) {
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("A to-do needs some text");
        }
        return trimmed.length() <= MAX_TEXT ? trimmed : trimmed.substring(0, MAX_TEXT);
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
