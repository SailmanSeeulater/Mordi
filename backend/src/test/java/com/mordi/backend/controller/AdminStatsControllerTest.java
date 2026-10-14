package com.mordi.backend.controller;

import com.mordi.backend.model.DailyStats;
import com.mordi.backend.service.StatsService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Who may see the usage numbers, and that everyone else is told nothing is there. */
class AdminStatsControllerTest {

    private final StatsService stats = mock(StatsService.class);
    private final DailyStats live = row(LocalDate.of(2026, 10, 14));
    private final DailyStats saved = row(LocalDate.of(2026, 10, 13));

    private static DailyStats row(LocalDate day) {
        DailyStats row = new DailyStats();
        row.setDay(day);
        return row;
    }

    @BeforeEach
    void setUp() {
        when(stats.today()).thenReturn(live);
        when(stats.recentDays()).thenReturn(List.of(saved));
    }

    @Test
    void anAdminGetsTodayAndTheSavedDays() {
        AdminStatsController controller = new AdminStatsController(stats, "owner@mordi.com");

        ResponseEntity<AdminStatsController.UsageResponse> response = controller.stats("owner@mordi.com");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().today()).isSameAs(live);
        assertThat(response.getBody().days()).containsExactly(saved);
    }

    @Test
    void anyoneElseIsToldItIsNotThereNotThatTheyMayNotSeeIt() {
        AdminStatsController controller = new AdminStatsController(stats, "owner@mordi.com");

        ResponseEntity<AdminStatsController.UsageResponse> response = controller.stats("someone@mordi.com");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNull();
        verifyNoInteractions(stats);
    }

    @Test
    void withNoAdminsConfiguredNobodyGetsIn() {
        for (String configured : new String[] {"", "  ", " , ,"}) {
            AdminStatsController controller = new AdminStatsController(stats, configured);

            assertThat(controller.stats("owner@mordi.com").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(controller.stats("").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(controller.stats(null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    @Test
    void theListIsCommaSeparatedAndCaseAndSpaceInsensitive() {
        AdminStatsController controller =
            new AdminStatsController(stats, " Owner@Mordi.com , second@mordi.com ,");

        assertThat(controller.stats("owner@mordi.com").getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(controller.stats("second@mordi.com").getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(controller.stats("third@mordi.com").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
