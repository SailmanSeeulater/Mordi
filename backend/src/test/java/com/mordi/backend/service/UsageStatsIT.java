package com.mordi.backend.service;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.DailyStats;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.DailyStatsRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The usage queries against a real PostgreSQL migrated by Flyway. The unit
 * tests stand the repositories in for mocks, so they cannot tell whether a
 * query is valid or the migration matches the entities; only a real database
 * does, and the full-application test that would is disabled. Each test's rows
 * are rolled back.
 *
 *   MORDI_IT_DB=1 SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mordi \
 *   SPRING_DATASOURCE_PASSWORD=... ./mvnw test -Dtest=UsageStatsIT
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "MORDI_IT_DB", matches = "1")
class UsageStatsIT {

    @Autowired private UserRepository users;
    @Autowired private GoalRepository goals;
    @Autowired private BehaviorRepository behaviors;
    @Autowired private TodoRepository todos;
    @Autowired private DailyStatsRepository dailyStats;
    @Autowired private EntityManager em;

    private LocalDate today;
    private StatsService stats;

    @BeforeEach
    void setUp() {
        // Rows stamp their creation in the JVM's own zone, which is UTC in
        // production; reading that same wall clock as UTC makes "today" agree
        // with it wherever this runs.
        Clock clock = Clock.fixed(LocalDateTime.now().toInstant(ZoneOffset.UTC), ZoneOffset.UTC);
        today = LocalDate.now(clock);
        stats = new StatsService(users, behaviors, todos, goals, dailyStats, clock);
    }

    private User person(LocalDate lastActiveOn) {
        User user = new User();
        user.setName("Person");
        user.setEmail("p-" + UUID.randomUUID() + "@it.mordi");
        user.setPassword("x");
        user.setLastActiveOn(lastActiveOn);
        return users.save(user);
    }

    /** Makes the account older than it is, the way a real one would be. */
    private void signedUp(User user, LocalDate day) {
        em.flush();
        em.createNativeQuery("update users set created_at = ?1 where id = ?2")
            .setParameter(1, day.atTime(12, 0))
            .setParameter(2, user.getId())
            .executeUpdate();
        em.clear();
    }

    @Test
    void markingActiveWritesOncePerDayAndEveryQuerySharesTheMigratedSchema() {
        User first = person(null);
        em.flush();

        assertThat(users.markActiveOn(first.getId(), today)).isEqualTo(1);
        assertThat(users.markActiveOn(first.getId(), today)).isEqualTo(0);
        assertThat(users.markActiveOn(first.getId(), today.plusDays(1))).isEqualTo(1);
        em.clear();
        assertThat(users.findById(first.getId()).orElseThrow().getLastActiveOn())
            .isEqualTo(today.plusDays(1));
    }

    @Test
    void theTotalsCountWhatTheyShouldAndNothingOutsideTheirWindow() {
        long usersBefore = users.count();

        User activeToday = person(today);
        person(today.minusDays(6));   // in the week and the month, not today
        person(today.minusDays(7));   // in the month only
        person(today.minusDays(29));  // the month's first day
        person(today.minusDays(30));  // just outside it
        person(null);                 // never seen

        // The cohort: 55 and 28 days back are in; 56 and 27 are not. Each of
        // the four is retained or not by its own last-seen date.
        User tooOld = person(today);
        signedUp(tooOld, today.minusDays(56));
        User oldest = person(today);
        signedUp(oldest, today.minusDays(55));
        User newest = person(today.minusDays(7));
        signedUp(newest, today.minusDays(28));
        User tooNew = person(today);
        signedUp(tooNew, today.minusDays(27));

        Goal goal = new Goal();
        goal.setUser(activeToday);
        goal.setTitle("Run");
        goals.save(goal);

        Behavior entry = new Behavior();
        entry.setUser(activeToday);
        entry.setNote("done");
        entry.setCompleted(true);
        entry.setLogDate(today.minusDays(3)); // backdated: counts as saved today
        behaviors.save(entry);

        Todo finished = new Todo();
        finished.setUser(activeToday);
        finished.setText("Call");
        finished.setDone(true);
        finished.setCompletedOn(today);
        todos.save(finished);
        Todo open = new Todo();
        open.setUser(activeToday);
        open.setText("Later");
        todos.save(open);
        em.flush();

        DailyStats now = stats.today();

        assertThat(now.getTotalUsers()).isEqualTo((int) (usersBefore + 10));
        assertThat(now.getNewUsers()).isEqualTo(6);             // the six not backdated
        assertThat(now.getActiveUsers()).isEqualTo(4);          // activeToday, tooOld, oldest, tooNew
        assertThat(now.getWeeklyActiveUsers()).isEqualTo(5);    // + the week's edge
        assertThat(now.getMonthlyActiveUsers()).isEqualTo(8);   // + 7 and 29 days back, and newest
        assertThat(now.getEntriesLogged()).isEqualTo(1);
        assertThat(now.getTodosDone()).isEqualTo(1);
        assertThat(now.getGoalsCreated()).isEqualTo(1);
        assertThat(now.getCohortSize()).isEqualTo(2);
        assertThat(now.getCohortRetained()).isEqualTo(1);       // oldest, not newest
    }

    @Test
    void takingTheSnapshotTwiceLeavesOneRowForTheDay() {
        stats.snapshotToday();
        em.flush();
        stats.snapshotToday();
        em.flush();
        em.clear();

        assertThat(dailyStats.findAll().stream().filter(row -> row.getDay().equals(today))).hasSize(1);
        assertThat(dailyStats.findTop90ByOrderByDayDesc().get(0).getDay()).isEqualTo(today);
    }
}
