package com.mordi.backend.service;

import com.mordi.backend.dto.TodoHistoryPage;
import com.mordi.backend.dto.TodoRequest;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * To-dos against a real PostgreSQL migrated by Flyway: V23's removed_at, the
 * list and the record leaving removed ones out, and History's page query
 * ordering by when each left the list. The unit tests mock all of these.
 * Each test's rows are rolled back.
 *
 *   MORDI_IT_DB=1 SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mordi \
 *   SPRING_DATASOURCE_PASSWORD=... ./mvnw test -Dtest=TodoQueriesIT
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "MORDI_IT_DB", matches = "1")
class TodoQueriesIT {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 3);

    @Autowired private UserRepository users;
    @Autowired private TodoRepository todos;
    @Autowired private EntityManager em;

    private User sam;
    private User alex;

    @BeforeEach
    void setUp() {
        sam = person("Sam");
        alex = person("Alex");
    }

    private User person(String name) {
        User user = new User();
        user.setName(name);
        user.setEmail(name.toLowerCase() + "-" + UUID.randomUUID() + "@it.mordi");
        user.setPassword("x");
        return users.save(user);
    }

    /** A service whose clock reads the given moment. */
    private TodoService at(String instant) {
        return new TodoService(todos, users, Clock.fixed(Instant.parse(instant), ZoneId.of("UTC")));
    }

    private Todo add(User owner, String text, String when) {
        TodoRequest request = new TodoRequest();
        request.setText(text);
        return at(when).createTodo(owner.getEmail(), request);
    }

    private void finish(User owner, Todo todo, String when) {
        TodoRequest request = new TodoRequest();
        request.setDone(true);
        request.setCompletedOn(DAY);
        at(when).updateTodo(owner.getEmail(), todo.getId(), request);
    }

    @Test
    void removedOnesLeaveTheListAndTheRecordButStayInHistory() {
        Todo dentist = add(sam, "Book the dentist", "2026-11-03T08:00:00Z");
        Todo bike = add(sam, "Fix the bike", "2026-11-03T08:01:00Z");
        Todo bank = add(sam, "Call the bank", "2026-11-03T08:02:00Z");
        add(sam, "Still open", "2026-11-03T08:03:00Z");
        add(alex, "Someone else's", "2026-11-03T08:04:00Z");

        finish(sam, dentist, "2026-11-03T09:00:00Z");
        finish(sam, bank, "2026-11-03T09:30:00Z");
        at("2026-11-03T10:00:00Z").deleteTodo(sam.getEmail(), bike.getId());
        at("2026-11-03T11:00:00Z").deleteTodo(sam.getEmail(), bank.getId());
        em.flush();
        em.clear();

        assertThat(at("2026-11-03T12:00:00Z").getTodos(sam.getEmail()))
            .extracting(Todo::getText).containsExactly("Still open", "Book the dentist");
        assertThat(todos.findFinishedBetween(sam, DAY, DAY)).extracting(Todo::getText).containsExactly("Book the dentist");
        assertThat(todos.countFinishedBetween(sam, DAY, DAY)).isEqualTo(1);

        TodoHistoryPage history = at("2026-11-03T12:00:00Z").getHistory(sam.getEmail(), 0);
        assertThat(history.items()).extracting(Todo::getText)
            .containsExactly("Call the bank", "Fix the bike", "Book the dentist");
        assertThat(history.items().get(1).getRemovedAt()).isEqualTo(Instant.parse("2026-11-03T10:00:00Z"));
        assertThat(history.hasMore()).isFalse();
    }

    @Test
    void historyComesAPageAtATime() {
        for (int n = 1; n <= TodoService.HISTORY_PAGE + 2; n++) {
            Todo todo = add(sam, "Task " + n, "2026-11-03T08:00:00Z");
            finish(sam, todo, Instant.parse("2026-11-03T09:00:00Z").plusSeconds(n).toString());
        }
        em.flush();
        em.clear();

        TodoHistoryPage first = at("2026-11-03T12:00:00Z").getHistory(sam.getEmail(), 0);
        assertThat(first.items()).hasSize(TodoService.HISTORY_PAGE);
        assertThat(first.items().get(0).getText()).isEqualTo("Task " + (TodoService.HISTORY_PAGE + 2));
        assertThat(first.hasMore()).isTrue();

        TodoHistoryPage second = at("2026-11-03T12:00:00Z").getHistory(sam.getEmail(), 1);
        assertThat(second.items()).extracting(Todo::getText).containsExactly("Task 2", "Task 1");
        assertThat(second.hasMore()).isFalse();
    }

    @Test
    void erasingTakesItOutOfHistory() {
        Todo bike = add(sam, "Fix the bike", "2026-11-03T08:00:00Z");
        at("2026-11-03T10:00:00Z").deleteTodo(sam.getEmail(), bike.getId());
        at("2026-11-03T10:05:00Z").eraseTodo(sam.getEmail(), bike.getId());
        em.flush();
        em.clear();

        assertThat(todos.findById(bike.getId())).isEmpty();
        assertThat(at("2026-11-03T12:00:00Z").getHistory(sam.getEmail(), 0).items()).isEmpty();
    }
}
