package com.mordi.backend.service;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.Report;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.ReportRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.LocalDate;
import java.util.ArrayList;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportServiceTest {

    private static final String ME = "me@mordi.com";
    /** A Wednesday, so week alignment is actually exercised. */
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 9, 16);
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 14);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 9, 20);

    @Mock private ReportRepository reportRepository;
    @Mock private UserRepository userRepository;
    @Mock private BehaviorRepository behaviorRepository;
    @Mock private GoalRepository goalRepository;

    private ReportService reportService;
    private User me;

    @BeforeEach
    void setUp() {
        reportService = new ReportService(
            reportRepository, userRepository, behaviorRepository, goalRepository);
        me = new User();
        me.setId(1L);
        me.setEmail(ME);
        me.setName("Me");
    }

    private void given(List<Goal> goals, List<Behavior> behaviors) {
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(goalRepository.findByUserAndActive(me, true)).thenReturn(goals);
        when(behaviorRepository.findByUserAndLogDateBetween(me, MONDAY, SUNDAY))
            .thenReturn(behaviors);
        when(reportRepository.findByUserAndWeekStart(any(), any())).thenReturn(Optional.empty());
        when(reportRepository.save(any(Report.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static Goal goal(Long id, int targetPerWeek) {
        Goal goal = new Goal();
        goal.setId(id);
        goal.setTitle("Goal " + id);
        goal.setTargetPerWeek(targetPerWeek);
        return goal;
    }

    private static Behavior entry(Goal goal, LocalDate day, boolean completed, String mood) {
        Behavior behavior = new Behavior();
        behavior.setGoal(goal);
        behavior.setLogDate(day);
        behavior.setCompleted(completed);
        behavior.setMood(mood);
        behavior.setNote("note");
        return behavior;
    }

    @Nested
    class WeekBoundaries {

        @Test
        void anyDayInTheWeekProducesTheSameMondayToSundayWindow() {
            given(List.of(), List.of());

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getWeekStart()).isEqualTo(MONDAY);
            assertThat(report.getWeekEnd()).isEqualTo(SUNDAY);
        }

        @Test
        void aMondayIsItsOwnWeekStart() {
            given(List.of(), List.of());

            assertThat(reportService.generateWeeklyReport(ME, MONDAY).getWeekStart())
                .isEqualTo(MONDAY);
        }

        @Test
        void aSundayBelongsToTheWeekThatStartedSixDaysEarlier() {
            given(List.of(), List.of());

            assertThat(reportService.generateWeeklyReport(ME, SUNDAY).getWeekStart())
                .isEqualTo(MONDAY);
        }
    }

    @Nested
    class MeasuringAgainstTargets {

        @Test
        void rateIsAchievedOverPlanned_notCompletedOverLogged() {
            Goal run = goal(10L, 4);
            // One ticked day out of a target of four. The old rule, which
            // divided ticks by entries, would have called this a 100% week.
            given(List.of(run), List.of(entry(run, MONDAY, true, "good")));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getPlannedEntries()).isEqualTo(4);
            assertThat(report.getAchievedEntries()).isEqualTo(1);
            assertThat(report.getCompletionRate()).isEqualTo(25.0);
        }

        @Test
        void twoEntriesOnOneDayCountAsOneDayTowardsTheTarget() {
            Goal run = goal(10L, 3);
            given(List.of(run), List.of(
                entry(run, MONDAY, true, "good"),
                entry(run, MONDAY, true, "great")));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getAchievedEntries()).isEqualTo(1);
            assertThat(report.getTotalBehaviors()).isEqualTo(2);
        }

        @Test
        void overshootingATargetDoesNotPushTheRateAbove100() {
            Goal read = goal(11L, 2);
            given(List.of(read), List.of(
                entry(read, MONDAY, true, "good"),
                entry(read, MONDAY.plusDays(1), true, "good"),
                entry(read, MONDAY.plusDays(2), true, "good")));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getAchievedEntries()).isEqualTo(2);
            assertThat(report.getCompletionRate()).isEqualTo(100.0);
            assertThat(report.getGoalsOnTrack()).isEqualTo(1);
        }

        @Test
        void untickedEntriesCountAsLoggedButNotAsAchieved() {
            Goal run = goal(10L, 2);
            given(List.of(run), List.of(entry(run, MONDAY, false, "bad")));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getTotalBehaviors()).isEqualTo(1);
            assertThat(report.getCompletedBehaviors()).isZero();
            assertThat(report.getAchievedEntries()).isZero();
        }

        @Test
        void entriesWithNoGoalCountAsLoggedOnly() {
            Goal run = goal(10L, 1);
            given(List.of(run), List.of(entry(null, MONDAY, true, "good")));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getTotalBehaviors()).isEqualTo(1);
            assertThat(report.getAchievedEntries()).isZero();
            assertThat(report.getGoalsOnTrack()).isZero();
        }

        @Test
        void aWeekWithNoGoalsHasNoRateRatherThanADivisionByZero() {
            given(List.of(), List.of());

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getPlannedEntries()).isZero();
            assertThat(report.getCompletionRate()).isZero();
            assertThat(report.getSummary()).isEqualTo("No goals and nothing logged this week.");
        }

        @Test
        void aTargetOfZeroIsTreatedAsOne() {
            // Rows written before the 1..7 validation can hold 0, which must
            // not make a goal impossible to be off track for.
            Goal legacy = goal(12L, 0);
            given(List.of(legacy), List.of());

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getPlannedEntries()).isEqualTo(1);
            assertThat(report.getGoalsOnTrack()).isZero();
        }
    }

    @Nested
    class Summary {

        @Test
        void namesTheMostCommonMoodAndTheGoalsOnTarget() {
            Goal run = goal(10L, 1);
            Goal read = goal(11L, 3);
            given(List.of(run, read), List.of(
                entry(run, MONDAY, true, "good"),
                entry(read, MONDAY, true, "good"),
                entry(read, MONDAY.plusDays(1), true, "great")));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getMostCommonMood()).isEqualTo("good");
            assertThat(report.getGoalsTotal()).isEqualTo(2);
            assertThat(report.getGoalsOnTrack()).isEqualTo(1);
            assertThat(report.getSummary())
                .contains("3 of 4 planned entries (75%)")
                .contains("1 of 2 reached target")
                .contains("most often good");
        }

        @Test
        void aWeekWithNoMoodsDoesNotInventOne() {
            Goal run = goal(10L, 1);
            given(List.of(run), List.of(entry(run, MONDAY, true, null)));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getMostCommonMood()).isNull();
            assertThat(report.getSummary())
                .contains("Every goal hit its target.")
                .doesNotContain("Mood");
        }

        @Test
        void hasNoExclamationMarks() {
            Goal run = goal(10L, 1);
            given(List.of(run), List.of(entry(run, MONDAY, true, "good")));

            assertThat(reportService.generateWeeklyReport(ME, WEDNESDAY).getSummary())
                .doesNotContain("!");
        }
    }

    @Nested
    class OnePerWeek {

        @Test
        void regeneratingRewritesTheExistingRowRatherThanAddingAnother() {
            Report existing = new Report();
            existing.setId(77L);
            existing.setUser(me);
            existing.setWeekStart(MONDAY);
            existing.setCompletionRate(12.0);

            Goal run = goal(10L, 2);
            when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
            when(goalRepository.findByUserAndActive(me, true)).thenReturn(List.of(run));
            when(behaviorRepository.findByUserAndLogDateBetween(me, MONDAY, SUNDAY))
                .thenReturn(List.of(
                    entry(run, MONDAY, true, "good"),
                    entry(run, MONDAY.plusDays(1), true, "good")));
            when(reportRepository.findByUserAndWeekStart(me, MONDAY))
                .thenReturn(Optional.of(existing));
            when(reportRepository.save(any(Report.class))).thenAnswer(inv -> inv.getArgument(0));

            Report report = reportService.generateWeeklyReport(ME, WEDNESDAY);

            assertThat(report.getId()).isEqualTo(77L);
            assertThat(report.getCompletionRate()).isEqualTo(100.0);
        }
    }

    @Nested
    class Listing {

        @Test
        void returnsWhatTheRepositoryHoldsForTheCaller() {
            List<Report> mine = new ArrayList<>();
            mine.add(new Report());
            when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
            when(reportRepository.findByUserOrderByWeekStartDesc(me)).thenReturn(mine);

            assertThat(reportService.getAllReports(ME)).isSameAs(mine);
        }
    }
}
