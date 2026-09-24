package com.mordi.backend.together;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.GoalMessage;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalMessageRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The shared-goal queries against a real PostgreSQL, migrated by Flyway: the
 * unit tests mock these repositories, so this is where the SQL itself is
 * checked. Each test's rows are rolled back.
 *
 * Needs a database, so it only runs when one is named:
 *   MORDI_IT_DB=1 SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/mordi \
 *   SPRING_DATASOURCE_PASSWORD=... ./mvnw test -Dtest=SharedGoalQueriesIT
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "MORDI_IT_DB", matches = "1")
class SharedGoalQueriesIT {

    @Autowired private UserRepository users;
    @Autowired private GoalRepository goals;
    @Autowired private GoalMemberRepository members;
    @Autowired private GoalMessageRepository messages;
    @Autowired private BehaviorRepository behaviors;

    private User sam;
    private User alex;
    private User jo;
    private Goal run;

    @BeforeEach
    void setUp() {
        sam = person("Sam");
        alex = person("Alex");
        jo = person("Jo");
        run = goal(sam, "Morning run");
        join(run, sam);
        join(run, alex);
    }

    private User person(String name) {
        User user = new User();
        user.setName(name);
        user.setEmail(name.toLowerCase() + "-" + UUID.randomUUID() + "@it.mordi");
        // A fixture row, never signed into: no real hash needed.
        user.setPassword("not-a-login");
        return users.save(user);
    }

    private Goal goal(User owner, String title) {
        Goal goal = new Goal();
        goal.setUser(owner);
        goal.setTitle(title);
        goal.setTargetPerWeek(4);
        return goals.save(goal);
    }

    private GoalMember join(Goal goal, User user) {
        GoalMember member = new GoalMember();
        member.setGoal(goal);
        member.setUser(user);
        return members.save(member);
    }

    private GoalMessage say(Goal goal, User user, String body) {
        GoalMessage message = new GoalMessage();
        message.setGoal(goal);
        message.setUser(user);
        message.setBody(body);
        return messages.save(message);
    }

    private void log(Goal goal, User user, LocalDate day, boolean completed) {
        Behavior entry = new Behavior();
        entry.setUser(user);
        entry.setGoal(goal);
        entry.setLogDate(day);
        entry.setCompleted(completed);
        entry.setNote("private note");
        entry.setMood("good");
        behaviors.save(entry);
    }

    @Test
    void findJoinedGoals_isGoalsOthersOwn_stillRunning_notMyOwn() {
        Goal archived = goal(sam, "Old");
        archived.setArchivedAt(LocalDateTime.now());
        goals.save(archived);
        join(archived, alex);
        Goal alexOwn = goal(alex, "Alex's own");
        join(alexOwn, alex);

        assertThat(members.findJoinedGoals(alex)).containsExactly(run);
        assertThat(members.findJoinedGoals(sam)).isEmpty();
        assertThat(members.findJoinedGoals(jo)).isEmpty();
    }

    @Test
    void countUnread_isOthersMessagesPastMyReadMark_perGoal() {
        GoalMember alexRow = members.findByGoalAndUser(run, alex).orElseThrow();
        GoalMessage first = say(run, sam, "Morning!");
        say(run, sam, "Ran 5k");
        say(run, alex, "Nice");

        Map<Long, Long> unread = asMap(messages.countUnread(alex));
        // Sam's two; Alex's own message never counts.
        assertThat(unread).containsEntry(run.getId(), 2L);

        alexRow.setLastReadMessageId(first.getId());
        members.save(alexRow);
        assertThat(asMap(messages.countUnread(alex))).containsEntry(run.getId(), 1L);

        // Jo is not in the goal, so has nothing to read in it.
        assertThat(messages.countUnread(jo)).isEmpty();
    }

    @Test
    void completedDaysForGoal_isWhoAndWhichDayOnly_forCompletedEntriesThatWeek() {
        LocalDate monday = LocalDate.of(2026, 9, 21);
        log(run, sam, monday, true);
        log(run, sam, monday, true);          // twice the same day counts once
        log(run, alex, monday.plusDays(1), true);
        log(run, alex, monday.plusDays(2), false); // not done
        log(run, alex, monday.plusDays(7), true);  // next week

        List<Object[]> rows = behaviors.completedDaysForGoal(run.getId(), monday, monday.plusDays(6));

        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(row -> assertThat(row).hasSize(2));
        assertThat(rows.stream().map(r -> r[0] + "@" + r[1]).toList()).containsExactlyInAnyOrder(
            sam.getId() + "@" + monday, alex.getId() + "@" + monday.plusDays(1));
    }

    @Test
    void countByGoalIds_andPaging_workOnRealRows() {
        assertThat(asMap(members.countByGoalIds(List.of(run.getId())))).containsEntry(run.getId(), 2L);

        for (int i = 0; i < 5; i++) {
            say(run, sam, "m" + i);
        }
        List<GoalMessage> newest = messages.findByGoalOrderByIdDesc(run, PageRequest.of(0, 3));
        assertThat(newest).extracting(GoalMessage::getBody).containsExactly("m4", "m3", "m2");
        List<GoalMessage> older = messages.findByGoalAndIdLessThanOrderByIdDesc(run, newest.get(2).getId(), PageRequest.of(0, 3));
        assertThat(older).extracting(GoalMessage::getBody).containsExactly("m1", "m0");
        assertThat(messages.countByUserAndCreatedAtAfter(sam, Instant.now().minusSeconds(60))).isEqualTo(5);
    }

    private static Map<Long, Long> asMap(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).longValue()));
    }
}
