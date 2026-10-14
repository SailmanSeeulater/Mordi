package com.mordi.backend.service;

import com.mordi.backend.model.DailyStats;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.DailyStatsRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Totals for how many people use Mordi and how much: counted from the
 * database, kept as one row a day, and never broken down by person.
 *
 * Every day here is a UTC day. The production container runs in UTC, so the
 * timestamps it writes (account, entry and goal creation) are UTC too, and a
 * UTC day's bounds are the right ones to count them in.
 */
@Service
public class StatsService {

    /** Active in the last 7 days counting today, and in the last 30. */
    static final int WEEK_DAYS = 7;
    static final int MONTH_DAYS = 30;

    /** The retention cohort: signed up 28 to 55 days ago, inclusive. */
    static final int COHORT_NEWEST_DAYS_AGO = 28;
    static final int COHORT_OLDEST_DAYS_AGO = 55;

    private final UserRepository users;
    private final BehaviorRepository behaviors;
    private final TodoRepository todos;
    private final GoalRepository goals;
    private final DailyStatsRepository dailyStats;
    private final Clock clock;

    @Autowired
    public StatsService(
            UserRepository users,
            BehaviorRepository behaviors,
            TodoRepository todos,
            GoalRepository goals,
            DailyStatsRepository dailyStats) {
        this(users, behaviors, todos, goals, dailyStats, Clock.systemUTC());
    }

    /** For tests, so the day can be moved without waiting. */
    StatsService(
            UserRepository users,
            BehaviorRepository behaviors,
            TodoRepository todos,
            GoalRepository goals,
            DailyStatsRepository dailyStats,
            Clock clock) {
        this.users = users;
        this.behaviors = behaviors;
        this.todos = todos;
        this.goals = goals;
        this.dailyStats = dailyStats;
        this.clock = clock;
    }

    /** Today's numbers, counted now and not saved. */
    public DailyStats today() {
        return compute(LocalDate.now(clock));
    }

    /**
     * Counts today and writes the row, replacing today's earlier one if there
     * is one, so running it twice is the same as running it once.
     */
    @Transactional
    public DailyStats snapshotToday() {
        // The day is the key and is assigned, so save() merges: an insert the
        // first time, an update of the same row after that.
        return dailyStats.save(today());
    }

    /** The last 90 days written, newest first. */
    @Transactional(readOnly = true)
    public List<DailyStats> recentDays() {
        return dailyStats.findTop90ByOrderByDayDesc();
    }

    DailyStats compute(LocalDate day) {
        LocalDateTime dayStart = day.atStartOfDay();
        LocalDateTime dayEnd = day.plusDays(1).atStartOfDay();

        // The cohort is whoever signed up from 55 days ago through 28 days
        // ago, both days whole; the end is exclusive, so it is the start of
        // the day after the 28th.
        LocalDateTime cohortFrom = day.minusDays(COHORT_OLDEST_DAYS_AGO).atStartOfDay();
        LocalDateTime cohortTo = day.minusDays(COHORT_NEWEST_DAYS_AGO - 1).atStartOfDay();
        LocalDate weekStart = day.minusDays(WEEK_DAYS - 1);

        DailyStats stats = new DailyStats();
        stats.setDay(day);
        stats.setTotalUsers(count(users.count()));
        stats.setNewUsers(count(users.countCreatedBetween(dayStart, dayEnd)));
        stats.setActiveUsers(count(users.countByLastActiveOn(day)));
        stats.setWeeklyActiveUsers(count(users.countByLastActiveOnGreaterThanEqual(weekStart)));
        stats.setMonthlyActiveUsers(count(
            users.countByLastActiveOnGreaterThanEqual(day.minusDays(MONTH_DAYS - 1))));
        // Entries are counted by when they were saved (createdAt), not by
        // logDate: logDate is the day the person says it happened on, and a
        // backdated entry would count as a day it was not logged.
        stats.setEntriesLogged(count(behaviors.countCreatedBetween(dayStart, dayEnd)));
        // A finished to-do carries only completedOn, the person's own day, so
        // that is the day it counts on.
        stats.setTodosDone(count(todos.countFinishedOn(day)));
        stats.setGoalsCreated(count(goals.countCreatedBetween(dayStart, dayEnd)));
        stats.setCohortSize(count(users.countCreatedBetween(cohortFrom, cohortTo)));
        stats.setCohortRetained(count(
            users.countCreatedBetweenAndActiveSince(cohortFrom, cohortTo, weekStart)));
        stats.setCreatedAt(LocalDateTime.now(clock));
        return stats;
    }

    private static int count(long n) {
        return Math.toIntExact(n);
    }
}
