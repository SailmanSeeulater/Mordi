package com.mordi.backend.service;

import com.mordi.backend.model.User;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/**
 * A person's week: seven days from the day they chose it to start on, Monday
 * or Sunday. Every weekly count runs over this week, so the dashboard, the
 * report and the reminder never disagree about which days are "this week".
 */
public final class Weeks {

    public static final String MONDAY = "monday";
    public static final String SUNDAY = "sunday";

    private Weeks() {
    }

    /** The day the person's week starts on; Monday unless they chose Sunday. */
    public static DayOfWeek firstDay(User user) {
        return user != null && SUNDAY.equals(user.getWeekStart()) ? DayOfWeek.SUNDAY : DayOfWeek.MONDAY;
    }

    /** The first day of the person's week containing {@code day}. */
    public static LocalDate start(LocalDate day, User user) {
        return start(day, firstDay(user));
    }

    /** The first day of the week containing {@code day}, weeks starting on {@code first}. */
    public static LocalDate start(LocalDate day, DayOfWeek first) {
        return day.with(TemporalAdjusters.previousOrSame(first));
    }

    /** A requested week start as stored. Anything but "monday" or "sunday" is refused. */
    public static String valid(String requested) {
        if (MONDAY.equals(requested) || SUNDAY.equals(requested)) {
            return requested;
        }
        throw new IllegalArgumentException("The week starts on \"monday\" or \"sunday\"");
    }
}
