package com.mordi.backend.service;

import com.mordi.backend.dto.TodoRequest;
import com.mordi.backend.exception.TodoNotFoundException;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TodoServiceTest {

    private static final String ME = "me@mordi.com";
    private static final Instant NOW = Instant.parse("2026-09-17T09:00:00Z");
    private static final ZoneId UTC = ZoneId.of("UTC");

    @Mock private TodoRepository todoRepository;
    @Mock private UserRepository userRepository;

    private TodoService todoService;
    private User me;
    private User them;

    @BeforeEach
    void setUp() {
        todoService = new TodoService(todoRepository, userRepository, Clock.fixed(NOW, UTC));
        me = user(1L, ME);
        them = user(2L, "them@mordi.com");
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(todoRepository.save(any(Todo.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName("Someone");
        return user;
    }

    private static TodoRequest request(String text, Boolean done) {
        TodoRequest request = new TodoRequest();
        request.setText(text);
        request.setDone(done);
        return request;
    }

    private Todo existing(Long id, User owner, boolean done) {
        Todo todo = new Todo();
        todo.setId(id);
        todo.setUser(owner);
        todo.setText("Buy milk");
        todo.setDone(done);
        todo.setCreatedAt(LocalDateTime.ofInstant(NOW, UTC).minusDays(1));
        if (done) {
            todo.setCompletedAt(LocalDateTime.ofInstant(NOW, UTC).minusHours(2));
        }
        return todo;
    }

    @Nested
    class Creating {

        @Test
        void trimsTheTextAndStartsOpen() {
            Todo todo = todoService.createTodo(ME, request("  Call the landlord  ", null));

            assertThat(todo.getText()).isEqualTo("Call the landlord");
            assertThat(todo.isDone()).isFalse();
            assertThat(todo.getUser()).isSameAs(me);
            assertThat(todo.getCreatedAt()).isEqualTo(LocalDateTime.ofInstant(NOW, UTC));
        }

        @Test
        void ignoresADoneFlagOnCreation() {
            // A to-do is added to be done later. Arriving already done would
            // skip the one thing the list is for.
            assertThat(todoService.createTodo(ME, request("Anything", true)).isDone()).isFalse();
        }

        @Test
        void refusesAnEmptyOrBlankItem() {
            assertThatThrownBy(() -> todoService.createTodo(ME, request("   ", null)))
                .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> todoService.createTodo(ME, request(null, null)))
                .isInstanceOf(IllegalArgumentException.class);
            verify(todoRepository, never()).save(any());
        }

        @Test
        void clampsOverlongTextRatherThanFailing() {
            Todo todo = todoService.createTodo(ME, request("x".repeat(500), null));
            assertThat(todo.getText()).hasSize(TodoService.MAX_TEXT);
        }
    }

    @Nested
    class TickingOff {

        @Test
        void finishingRecordsWhen() {
            when(todoRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me, false)));

            Todo todo = todoService.updateTodo(ME, 5L, request(null, true));

            assertThat(todo.isDone()).isTrue();
            assertThat(todo.getCompletedAt()).isEqualTo(LocalDateTime.ofInstant(NOW, UTC));
        }

        @Test
        void reopeningClearsTheCompletionTime() {
            when(todoRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me, true)));

            Todo todo = todoService.updateTodo(ME, 5L, request(null, false));

            assertThat(todo.isDone()).isFalse();
            assertThat(todo.getCompletedAt()).isNull();
        }

        @Test
        void sendingTheSameStateAgainDoesNotMoveTheCompletionTime() {
            Todo done = existing(5L, me, true);
            LocalDateTime original = done.getCompletedAt();
            when(todoRepository.findById(5L)).thenReturn(Optional.of(done));

            Todo todo = todoService.updateTodo(ME, 5L, request(null, true));

            assertThat(todo.getCompletedAt()).isEqualTo(original);
        }

        @Test
        void renamingLeavesTheStateAlone() {
            when(todoRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me, true)));

            Todo todo = todoService.updateTodo(ME, 5L, request("Buy oat milk", null));

            assertThat(todo.getText()).isEqualTo("Buy oat milk");
            assertThat(todo.isDone()).isTrue();
        }
    }

    @Nested
    class Ownership {

        @Test
        void updatingAnotherUsersItemIsReportedAsNotFound() {
            when(todoRepository.findById(9L)).thenReturn(Optional.of(existing(9L, them, false)));

            assertThatThrownBy(() -> todoService.updateTodo(ME, 9L, request(null, true)))
                .isInstanceOf(TodoNotFoundException.class)
                .hasMessage("To-do not found");
            verify(todoRepository, never()).save(any());
        }

        @Test
        void deletingAnotherUsersItemIsReportedAsNotFound() {
            when(todoRepository.findById(9L)).thenReturn(Optional.of(existing(9L, them, false)));

            assertThatThrownBy(() -> todoService.deleteTodo(ME, 9L))
                .isInstanceOf(TodoNotFoundException.class);
            verify(todoRepository, never()).delete(any());
        }

        @Test
        void aMissingItemFailsTheSameWay() {
            when(todoRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> todoService.deleteTodo(ME, 404L))
                .isInstanceOf(TodoNotFoundException.class)
                .hasMessage("To-do not found");
        }

        @Test
        void deletingOwnItemRemovesIt() {
            Todo mine = existing(5L, me, false);
            when(todoRepository.findById(5L)).thenReturn(Optional.of(mine));

            todoService.deleteTodo(ME, 5L);

            verify(todoRepository).delete(mine);
        }
    }

    @Nested
    class Listing {

        @Test
        void asksForOpenItemsFirstInTheOrderTheyWereAdded() {
            List<Todo> mine = List.of(existing(1L, me, false));
            when(todoRepository.findByUserOrderByDoneAscCreatedAtAsc(me)).thenReturn(mine);

            assertThat(todoService.getTodos(ME)).isSameAs(mine);
        }

        @Test
        void clearingDoneOnlyTouchesTheCallersItems() {
            when(todoRepository.deleteDoneByUser(me)).thenReturn(3);

            assertThat(todoService.clearDone(ME)).isEqualTo(3);
            verify(todoRepository).deleteDoneByUser(me);
        }
    }
}
