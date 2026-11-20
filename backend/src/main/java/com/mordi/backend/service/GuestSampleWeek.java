package com.mordi.backend.service;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.Note;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.TodoStep;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.NoteRepository;
import com.mordi.backend.repository.TodoRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The made-up fortnight a guest account opens with, so the week card, the
 * calendar, the heatmap and last week's report have something to show before
 * the person has logged anything. Two weeks back to yesterday; today is left
 * for them.
 *
 * Every figure is illustrative, and the pinned note says so. The pattern is
 * fixed rather than random, so every guest sees the same believable week:
 * mostly on pace, one goal behind, a miss here and there.
 */
@Component
@RequiredArgsConstructor
public class GuestSampleWeek {

    static final int DAYS_BACK = 14;

    private static final String[] MOODS = {"good", "great", "good", "neutral", "good", "bad", "great"};

    private final GoalRepository goals;
    private final BehaviorRepository behaviors;
    private final TodoRepository todos;
    private final NoteRepository notes;

    private record Habit(String title, String category, int target, Short plannedDays,
                         String note, boolean[] week) {}

    // Which weekdays (Monday first) each goal was done on. The run is planned
    // for Monday, Wednesday and Friday, and missed one Friday below.
    private static final List<Habit> HABITS = List.of(
        new Habit("Morning run", "fitness", 3, (short) 0b0010101, "Easy 5k around the park",
            new boolean[] {true, false, true, false, true, false, false}),
        new Habit("Read before bed", "productivity", 5, null, "Twenty pages",
            new boolean[] {true, true, false, true, true, false, true}),
        new Habit("Lights out by 11", "sleep", 4, null, "In bed by 10:45",
            new boolean[] {false, true, true, false, false, true, true}),
        new Habit("Drink 2L of water", "health", 6, null, "Kept the bottle on the desk",
            new boolean[] {true, true, false, false, true, false, false}));

    public void fill(User user, LocalDate today) {
        ZoneId zone = ZoneId.of(user.getTimeZone() == null ? "UTC" : user.getTimeZone());

        List<Goal> made = new ArrayList<>();
        for (Habit habit : HABITS) {
            Goal goal = new Goal();
            goal.setUser(user);
            goal.setTitle(habit.title());
            goal.setFrequency(habit.target() == 7 ? "daily" : "weekly");
            goal.setCategory(habit.category());
            goal.setTargetPerWeek(habit.target());
            goal.setPlannedDays(habit.plannedDays());
            // Older than the entries below, or the week card and the report
            // would leave out the days before the goal "existed".
            goal.setCreatedAt(today.minusDays(DAYS_BACK + 1).atStartOfDay());
            made.add(goal);
        }
        goals.saveAll(made);

        List<Behavior> entries = new ArrayList<>();
        for (int back = DAYS_BACK; back >= 1; back--) {
            LocalDate day = today.minusDays(back);
            int weekday = day.getDayOfWeek().getValue() - 1;
            for (int i = 0; i < HABITS.size(); i++) {
                Habit habit = HABITS.get(i);
                // The run's one miss: the Friday of the earlier week.
                boolean missed = i == 0 && back > 7 && day.getDayOfWeek() == DayOfWeek.FRIDAY;
                if (!habit.week()[weekday] || missed) {
                    continue;
                }
                Behavior entry = new Behavior();
                entry.setUser(user);
                entry.setGoal(made.get(i));
                entry.setNote(habit.note());
                entry.setCompleted(true);
                entry.setMood(MOODS[(back + i) % MOODS.length]);
                entry.setLogDate(day);
                entry.setLoggedAt(day.atTime(LocalTime.of(19 + i % 3, 15)).atZone(zone).toInstant());
                entries.add(entry);
            }
        }
        behaviors.saveAll(entries);

        todos.saveAll(List.of(
            todo(user, "Plan the weekend hike", List.of(
                new TodoStep("s1", "Pick a trail", true),
                new TodoStep("s2", "Check the weather", false),
                new TodoStep("s3", "Pack snacks", false))),
            todo(user, "Book a dentist appointment", List.of()),
            todo(user, "Call grandma", List.of()),
            finished(user, "Renew library card", today.minusDays(2), zone),
            finished(user, "Fix the bike tyre", today.minusDays(5), zone)));

        Note note = new Note();
        note.setUser(user);
        note.setTitle("Welcome to Mordi");
        note.setBody("""
            Everything here is **sample data** so you can look around: \
            the goals, the past two weeks of entries, the to-dos and this note.

            Change any of it, or log something for today and watch the week fill in.

            This demo is deleted after a week. **Save your account** (top of the page) \
            to keep what you make.""");
        note.setPinned(true);
        notes.save(note);
    }

    private static Todo todo(User user, String text, List<TodoStep> steps) {
        Todo todo = new Todo();
        todo.setUser(user);
        todo.setText(text);
        todo.setSteps(new ArrayList<>(steps));
        return todo;
    }

    private static Todo finished(User user, String text, LocalDate day, ZoneId zone) {
        Todo todo = todo(user, text, List.of());
        todo.setDone(true);
        todo.setCompletedOn(day);
        todo.setCompletedAt(day.atTime(18, 30).atZone(zone).toInstant());
        return todo;
    }
}
