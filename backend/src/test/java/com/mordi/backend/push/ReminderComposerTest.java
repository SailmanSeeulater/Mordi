package com.mordi.backend.push;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReminderComposerTest {

    // Thursday 17 September 2026: Monday was the 14th, four days left.
    private static final LocalDate THURSDAY = LocalDate.of(2026, 9, 17);
    private static final LocalDate MON = LocalDate.of(2026, 9, 14);
    private static final LocalDate TUE = LocalDate.of(2026, 9, 15);

    private static ReminderComposer.GoalProgress goal(String title, int target, LocalDate... done) {
        return new ReminderComposer.GoalProgress(title, target, Set.of(done));
    }

    @Test
    void countsDaysLeftIncludingToday() {
        assertThat(ReminderComposer.daysLeft(MON)).isEqualTo(7);
        assertThat(ReminderComposer.daysLeft(THURSDAY)).isEqualTo(4);
        assertThat(ReminderComposer.daysLeft(LocalDate.of(2026, 9, 20))).isEqualTo(1);
    }

    @Test
    void listsWhatIsLeftMostPressingFirst() {
        ReminderComposer.Reminder r = ReminderComposer.compose(List.of(
            goal("Run", 4, MON, TUE),          // 2 of 4 left: half
            goal("Read", 7, MON),              // 6 of 7 left: most pressing
            goal("Stretch", 3, MON, TUE, THURSDAY)), // met: not mentioned
            THURSDAY);

        assertThat(r.title()).isEqualTo("4 days left this week");
        assertThat(r.body()).isEqualTo("Read: 6 of 7 left · Run: 2 of 4 left");
    }

    @Test
    void saysNothingWhenEveryTargetIsMet() {
        assertThat(ReminderComposer.compose(List.of(goal("Run", 2, MON, TUE)), THURSDAY)).isNull();
        assertThat(ReminderComposer.compose(List.of(), THURSDAY)).isNull();
    }

    @Test
    void ignoresDaysOutsideThisWeek() {
        ReminderComposer.Reminder r = ReminderComposer.compose(
            List.of(goal("Run", 2, LocalDate.of(2026, 9, 10), MON)), THURSDAY);
        assertThat(r.body()).isEqualTo("Run: 1 of 2 left");
    }

    @Test
    void capsTheListAndCountsTheRest() {
        ReminderComposer.Reminder r = ReminderComposer.compose(List.of(
            goal("A", 3), goal("B", 3), goal("C", 3), goal("D", 3), goal("E", 3)), LocalDate.of(2026, 9, 20));
        assertThat(r.title()).isEqualTo("Last day of the week");
        assertThat(r.body()).endsWith("· and 2 more");
    }
}
