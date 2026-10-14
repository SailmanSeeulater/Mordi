package com.mordi.backend.service;

import com.mordi.backend.model.DailyStats;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.DailyStatsRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The daily totals, with each repository count stood in for so the test is
 * about which question is asked of which day, not about the database.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StatsServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private static final Instant NOW = Instant.parse("2026-10-14T23:55:00Z");

    @Mock private UserRepository users;
    @Mock private BehaviorRepository behaviors;
    @Mock private TodoRepository todos;
    @Mock private GoalRepository goals;
    @Mock private DailyStatsRepository dailyStats;

    private StatsService stats;

    @BeforeEach
    void setUp() {
        stats = new StatsService(users, behaviors, todos, goals, dailyStats,
            Clock.fixed(NOW, ZoneId.of("UTC")));
        when(dailyStats.save(any(DailyStats.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static LocalDateTime start(LocalDate day) {
        return day.atStartOfDay();
    }

    @Test
    void everyFieldComesFromItsOwnCount() {
        when(users.count()).thenReturn(120L);
        // New today, and the retention cohort, are both "accounts made
        // between"; they are told apart by the window they ask about.
        when(users.countCreatedBetween(start(TODAY), start(TODAY.plusDays(1)))).thenReturn(3L);
        when(users.countByLastActiveOn(TODAY)).thenReturn(40L);
        when(users.countByLastActiveOnGreaterThanEqual(TODAY.minusDays(6))).thenReturn(70L);
        when(users.countByLastActiveOnGreaterThanEqual(TODAY.minusDays(29))).thenReturn(95L);
        when(behaviors.countCreatedBetween(start(TODAY), start(TODAY.plusDays(1)))).thenReturn(210L);
        when(todos.countFinishedOn(TODAY)).thenReturn(55L);
        when(goals.countCreatedBetween(start(TODAY), start(TODAY.plusDays(1)))).thenReturn(9L);
        LocalDateTime cohortFrom = start(TODAY.minusDays(55));
        LocalDateTime cohortTo = start(TODAY.minusDays(27));
        when(users.countCreatedBetween(cohortFrom, cohortTo)).thenReturn(20L);
        when(users.countCreatedBetweenAndActiveSince(cohortFrom, cohortTo, TODAY.minusDays(6)))
            .thenReturn(8L);

        DailyStats today = stats.today();

        assertThat(today.getDay()).isEqualTo(TODAY);
        assertThat(today.getTotalUsers()).isEqualTo(120);
        assertThat(today.getNewUsers()).isEqualTo(3);
        assertThat(today.getActiveUsers()).isEqualTo(40);
        assertThat(today.getWeeklyActiveUsers()).isEqualTo(70);
        assertThat(today.getMonthlyActiveUsers()).isEqualTo(95);
        assertThat(today.getEntriesLogged()).isEqualTo(210);
        assertThat(today.getTodosDone()).isEqualTo(55);
        assertThat(today.getGoalsCreated()).isEqualTo(9);
        assertThat(today.getCohortSize()).isEqualTo(20);
        assertThat(today.getCohortRetained()).isEqualTo(8);
        assertThat(today.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 10, 14, 23, 55));
    }

    @Test
    void theLiveNumbersAreNotSaved() {
        stats.today();

        verify(dailyStats, never()).save(any());
    }

    @Test
    void theWeekIsTheLastSevenDaysAndTheMonthTheLastThirtyCountingToday() {
        stats.today();

        // Today and the six days before it; today and the twenty-nine.
        verify(users).countByLastActiveOnGreaterThanEqual(LocalDate.of(2026, 10, 8));
        verify(users).countByLastActiveOnGreaterThanEqual(LocalDate.of(2026, 9, 15));
    }

    @Test
    void theCohortRunsFromFiftyFiveDaysAgoThroughTwentyEightInclusive() {
        stats.today();

        // Oldest day: the 55th day back, from its first instant. Newest day:
        // the 28th day back, whole, so the window closes where the 27th
        // day back begins.
        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> to = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(users).countCreatedBetweenAndActiveSince(
            from.capture(), to.capture(), any(LocalDate.class));
        assertThat(from.getValue()).isEqualTo(LocalDateTime.of(2026, 8, 20, 0, 0));
        assertThat(to.getValue()).isEqualTo(LocalDateTime.of(2026, 9, 17, 0, 0));
        // Aug 20 is 55 days before Oct 14, and Sep 16 is 28 days before: the
        // last whole day inside, so the window closes at the start of Sep 17.
        assertThat(TODAY.minusDays(55)).isEqualTo(LocalDate.of(2026, 8, 20));
        assertThat(TODAY.minusDays(28)).isEqualTo(LocalDate.of(2026, 9, 16));
    }

    @Test
    void theDaysWindowRunsFromMidnightToMidnight() {
        stats.today();

        verify(users, times(1)).countCreatedBetween(
            LocalDateTime.of(2026, 10, 14, 0, 0), LocalDateTime.of(2026, 10, 15, 0, 0));
    }

    @Test
    void takingTheSnapshotSavesTodaysRowOnItsDay() {
        when(users.count()).thenReturn(12L);

        DailyStats saved = stats.snapshotToday();

        ArgumentCaptor<DailyStats> row = ArgumentCaptor.forClass(DailyStats.class);
        verify(dailyStats).save(row.capture());
        assertThat(row.getValue().getDay()).isEqualTo(TODAY);
        assertThat(row.getValue().getTotalUsers()).isEqualTo(12);
        assertThat(saved).isSameAs(row.getValue());
    }

    @Test
    void takingItTwiceWritesTheSameKeyBothTimes() {
        // Saving by an assigned day is a merge: the second run replaces the
        // first rather than adding a row, so both must name the same day.
        stats.snapshotToday();
        stats.snapshotToday();

        ArgumentCaptor<DailyStats> rows = ArgumentCaptor.forClass(DailyStats.class);
        verify(dailyStats, times(2)).save(rows.capture());
        assertThat(rows.getAllValues()).extracting(DailyStats::getDay).containsOnly(TODAY);
    }

    @Test
    void recentDaysComeFromTheStoreNewestFirst() {
        DailyStats row = new DailyStats();
        row.setDay(TODAY.minusDays(1));
        when(dailyStats.findTop90ByOrderByDayDesc()).thenReturn(List.of(row));

        assertThat(stats.recentDays()).containsExactly(row);
    }
}
