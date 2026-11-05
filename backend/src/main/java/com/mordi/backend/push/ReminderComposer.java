package com.mordi.backend.push;

import com.mordi.backend.service.PlannedDays;
import com.mordi.backend.service.Weeks;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * What a reminder says. Pure: goals, the days each was done this week, and
 * today, in; a title and body out, or nothing.
 *
 * Only facts against targets the person set: what is left and how many days
 * remain, most pressing first. Nothing when every target is already met,
 * because a reminder that there is nothing to do is noise. No streaks, no
 * scolding, no invented urgency. A goal planned for particular weekdays is
 * only mentioned on one of them, until it is done that day.
 */
public final class ReminderComposer {

    /**
     * One goal's week. `plannedDays` is its weekday mask (bit 0 Monday), or
     * null when any day counts.
     */
    public record GoalProgress(String title, int target, Set<LocalDate> doneDays, Short plannedDays) {
        public GoalProgress(String title, int target, Set<LocalDate> doneDays) {
            this(title, target, doneDays, null);
        }
    }

    public record Reminder(String title, String body) {
    }

    static final int MAX_LISTED = 3;

    private ReminderComposer() {
    }

    /**
     * Days from today to the end of the week, today included: 7 on its first
     * day, 1 on its last (Sunday, or Saturday for a week that starts Sunday).
     */
    static int daysLeft(LocalDate today, DayOfWeek firstDay) {
        return 7 - (int) ChronoUnit.DAYS.between(Weeks.start(today, firstDay), today);
    }

    /** For a week that starts on Monday. */
    static int daysLeft(LocalDate today) {
        return daysLeft(today, DayOfWeek.MONDAY);
    }

    /** For a week that starts on Monday. */
    public static Reminder compose(List<GoalProgress> goals, LocalDate today) {
        return compose(goals, today, DayOfWeek.MONDAY);
    }

    public static Reminder compose(List<GoalProgress> goals, LocalDate today, DayOfWeek firstDay) {
        LocalDate weekStart = Weeks.start(today, firstDay);
        int daysLeft = daysLeft(today, firstDay);

        record Left(String title, int left, int target) {
        }
        List<Left> behind = new ArrayList<>();
        for (GoalProgress g : goals) {
            long done = g.doneDays().stream().filter(d -> !d.isBefore(weekStart) && !d.isAfter(today)).count();
            int left = (int) Math.max(0, g.target() - done);
            if (left > 0 && dueToday(g, today)) {
                behind.add(new Left(g.title(), left, g.target()));
            }
        }
        if (behind.isEmpty()) {
            return null;
        }
        // Most pressing first: the largest share of the target still to do.
        behind.sort(Comparator.comparingDouble((Left l) -> -(double) l.left() / l.target())
            .thenComparing(Left::title));

        StringBuilder body = new StringBuilder();
        for (int i = 0; i < Math.min(MAX_LISTED, behind.size()); i++) {
            Left l = behind.get(i);
            if (i > 0) {
                body.append(" · ");
            }
            body.append(l.title()).append(": ").append(l.left()).append(" of ").append(l.target()).append(" left");
        }
        if (behind.size() > MAX_LISTED) {
            body.append(" · and ").append(behind.size() - MAX_LISTED).append(" more");
        }
        String title = daysLeft == 1
            ? "Last day of the week"
            : daysLeft + " days left this week";
        return new Reminder(title, body.toString());
    }

    /**
     * Whether a goal with days left belongs in today's reminder. A goal with
     * no planned days always does, while its target is short. A goal planned
     * for particular weekdays only does on one of them, and only until it is
     * done that day: a Monday, Wednesday and Friday run says nothing on a
     * Tuesday.
     */
    static boolean dueToday(GoalProgress g, LocalDate today) {
        if (g.plannedDays() == null || g.plannedDays() == 0) {
            return true;
        }
        return PlannedDays.includes(g.plannedDays(), today.getDayOfWeek()) && !g.doneDays().contains(today);
    }

    /** Groups completed entry dates by goal title, for {@link #compose}. */
    public static List<GoalProgress> progress(Map<String, Integer> targets, Map<String, Set<LocalDate>> doneDays) {
        List<GoalProgress> out = new ArrayList<>();
        targets.forEach((title, target) -> out.add(new GoalProgress(title, target, doneDays.getOrDefault(title, Set.of()))));
        return out;
    }
}
