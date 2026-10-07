package com.mordi.backend.service;

import com.mordi.backend.dto.TodoRequest;
import com.mordi.backend.exception.TodoNotFoundException;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-line to-dos. No description, no due date, no target: done or not.
 *
 * Finishing one is part of the record, like logging an entry: it shows in
 * Lately on the day it was done and counts in that week's report. Clearing
 * finished items tidies the list without erasing that; deleting one removes
 * it everywhere.
 */
@Service
public class TodoService {

    /** Long enough for a sentence, short enough to stay one line on a phone. */
    static final int MAX_TEXT = 200;

    /** A year of history in one request is plenty for any screen that asks. */
    static final long MAX_RANGE_DAYS = 366;

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
        return todoRepository.findByUserAndClearedAtIsNullOrderByDoneAscCreatedAtAsc(findUser(email));
    }

    /** Finished on the days from start to end inclusive, cleared from the list or not. */
    public List<Todo> getFinished(String email, LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start)) {
            throw new IllegalArgumentException("start must be on or before end");
        }
        if (ChronoUnit.DAYS.between(start, end) > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("Ask for at most a year at a time");
        }
        return todoRepository.findFinishedBetween(findUser(email), start, end);
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
            // to-do clears it, finishing it again sets it afresh. The day is
            // the person's own, as the browser sends it; the server's date
            // stands in only when it does not.
            if (request.getDone()) {
                todo.setCompletedAt(Instant.now(clock));
                todo.setCompletedOn(request.getCompletedOn() != null
                    ? request.getCompletedOn()
                    : LocalDate.now(clock));
            } else {
                todo.setCompletedAt(null);
                todo.setCompletedOn(null);
            }
        }
        return todoRepository.save(todo);
    }

    /** Gone everywhere: from the list, from Lately and from the reports. */
    public void deleteTodo(String email, Long id) {
        todoRepository.delete(findOwnedTodo(email, id));
    }

    /**
     * Takes everything ticked off off the list, in one go, keeping it in
     * Lately and the reports. Returns how many were cleared.
     */
    @Transactional
    public int clearDone(String email) {
        return todoRepository.clearDoneByUser(findUser(email), Instant.now(clock));
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
