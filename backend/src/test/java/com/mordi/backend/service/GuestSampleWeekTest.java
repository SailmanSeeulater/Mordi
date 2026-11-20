package com.mordi.backend.service;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.Note;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.NoteRepository;
import com.mordi.backend.repository.TodoRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class GuestSampleWeekTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 19); // a Thursday

    @Mock private GoalRepository goals;
    @Mock private BehaviorRepository behaviors;
    @Mock private TodoRepository todos;
    @Mock private NoteRepository notes;

    private List<Goal> madeGoals;
    private List<Behavior> madeEntries;
    private List<Todo> madeTodos;
    private Note madeNote;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void fill() {
        User guest = new User();
        guest.setTimeZone("Europe/Berlin");
        new GuestSampleWeek(goals, behaviors, todos, notes).fill(guest, TODAY);

        ArgumentCaptor<Iterable<Goal>> g = ArgumentCaptor.forClass(Iterable.class);
        verify(goals).saveAll(g.capture());
        madeGoals = list(g.getValue());
        ArgumentCaptor<Iterable<Behavior>> b = ArgumentCaptor.forClass(Iterable.class);
        verify(behaviors).saveAll(b.capture());
        madeEntries = list(b.getValue());
        ArgumentCaptor<Iterable<Todo>> t = ArgumentCaptor.forClass(Iterable.class);
        verify(todos).saveAll(t.capture());
        madeTodos = list(t.getValue());
        ArgumentCaptor<Note> n = ArgumentCaptor.forClass(Note.class);
        verify(notes).save(n.capture());
        madeNote = n.getValue();
    }

    private static <T> List<T> list(Iterable<T> items) {
        List<T> out = new ArrayList<>();
        items.forEach(out::add);
        return out;
    }

    @Test
    void theEntriesCoverTwoWeeksUpToYesterday() {
        assertThat(madeEntries).isNotEmpty();
        assertThat(madeEntries).allSatisfy(entry -> {
            assertThat(entry.getLogDate()).isBefore(TODAY);
            assertThat(entry.getLogDate()).isAfterOrEqualTo(TODAY.minusDays(GuestSampleWeek.DAYS_BACK));
            assertThat(entry.isCompleted()).isTrue();
            assertThat(madeGoals).contains(entry.getGoal());
        });
    }

    @Test
    void theGoalsPredateTheirEntries() {
        LocalDate first = madeEntries.stream().map(Behavior::getLogDate).min(LocalDate::compareTo).orElseThrow();
        assertThat(madeGoals).allSatisfy(goal ->
            assertThat(goal.getCreatedAt().toLocalDate()).isBefore(first));
    }

    @Test
    void theRunIsOnlyLoggedOnItsPlannedDays() {
        Goal run = madeGoals.get(0);
        assertThat(run.getPlannedDays()).isEqualTo((short) 0b0010101);
        assertThat(madeEntries.stream().filter(e -> e.getGoal() == run))
            .allSatisfy(e -> assertThat(e.getLogDate().getDayOfWeek().getValue()).isIn(1, 3, 5));
    }

    @Test
    void eachGoalUsesABuiltInCategoryAndAValidTarget() {
        assertThat(madeGoals).allSatisfy(goal -> {
            assertThat(Icons.BUILT_IN_CATEGORIES).contains(goal.getCategory());
            assertThat(goal.getTargetPerWeek()).isBetween(1, 7);
        });
    }

    @Test
    void someToDosAreOpenAndSomeFinishedThisFortnight() {
        assertThat(madeTodos).anySatisfy(todo -> assertThat(todo.isDone()).isFalse());
        assertThat(madeTodos).anySatisfy(todo -> assertThat(todo.getSteps()).isNotEmpty());
        assertThat(madeTodos.stream().filter(Todo::isDone)).allSatisfy(todo -> {
            assertThat(todo.getCompletedOn()).isBefore(TODAY);
            assertThat(todo.getCompletedAt()).isNotNull();
        });
    }

    @Test
    void thePinnedNoteSaysItIsSampleData() {
        assertThat(madeNote.isPinned()).isTrue();
        assertThat(madeNote.getBody()).contains("sample data").contains("deleted after a week");
    }
}
