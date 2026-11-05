package com.mordi.backend.service;

import com.mordi.backend.model.User;
import java.time.DayOfWeek;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WeeksTest {

    // Wednesday 16 September 2026, between Sunday the 13th and Sunday the 20th.
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 9, 16);

    private static User startingOn(String weekStart) {
        User user = new User();
        user.setWeekStart(weekStart);
        return user;
    }

    @Test
    void aNewAccountsWeekStartsOnMonday() {
        assertThat(new User().getWeekStart()).isEqualTo("monday");
        assertThat(Weeks.firstDay(new User())).isEqualTo(DayOfWeek.MONDAY);
        assertThat(Weeks.start(WEDNESDAY, new User())).isEqualTo(LocalDate.of(2026, 9, 14));
    }

    @Test
    void aWeekThatStartsOnSundayStartsOnTheSundayBefore() {
        User user = startingOn("sunday");
        assertThat(Weeks.start(WEDNESDAY, user)).isEqualTo(LocalDate.of(2026, 9, 13));
        // A Sunday is the first day of its own week, a Saturday the last.
        assertThat(Weeks.start(LocalDate.of(2026, 9, 20), user)).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(Weeks.start(LocalDate.of(2026, 9, 19), user)).isEqualTo(LocalDate.of(2026, 9, 13));
    }

    @Test
    void aMondayWeekPutsSundayAtTheEnd() {
        assertThat(Weeks.start(LocalDate.of(2026, 9, 20), startingOn("monday"))).isEqualTo(LocalDate.of(2026, 9, 14));
    }

    @Test
    void onlyMondayOrSundayIsAccepted() {
        assertThat(Weeks.valid("sunday")).isEqualTo("sunday");
        assertThat(Weeks.valid("monday")).isEqualTo("monday");
        assertThatThrownBy(() -> Weeks.valid("saturday")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Weeks.valid(null)).isInstanceOf(IllegalArgumentException.class);
    }
}
