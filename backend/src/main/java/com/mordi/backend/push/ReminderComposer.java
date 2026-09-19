package com.mordi.backend.push;

import java.time.DayOfWeek;
import java.time.LocalDate;
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
 * scolding, no invented urgency.
 */
public final class ReminderComposer {

    public record GoalProgress(String title, int target, Set<LocalDate> doneDays) {
    }

    public record Reminder(String title, String body) {
    }

    static final int MAX_LISTED = 3;

    private ReminderComposer() {
    }

    /** Days from today to Sunday, today included: 7 on Monday, 1 on Sunday. */
    static int daysLeft(LocalDate today) {
        return DayOfWeek.SUNDAY.getValue() - today.getDayOfWeek().getValue() + 1;
    }

    public static Reminder compose(List<GoalProgress> goals, LocalDate today) {
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        int daysLeft = daysLeft(today);

        record Left(String title, int left, int target) {
        }
        List<Left> behind = new ArrayList<>();
        for (GoalProgress g : goals) {
            long done = g.doneDays().stream().filter(d -> !d.isBefore(monday) && !d.isAfter(today)).count();
            int left = (int) Math.max(0, g.target() - done);
            if (left > 0) {
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

    /** Groups completed entry dates by goal title, for {@link #compose}. */
    public static List<GoalProgress> progress(Map<String, Integer> targets, Map<String, Set<LocalDate>> doneDays) {
        List<GoalProgress> out = new ArrayList<>();
        targets.forEach((title, target) -> out.add(new GoalProgress(title, target, doneDays.getOrDefault(title, Set.of()))));
        return out;
    }
}
