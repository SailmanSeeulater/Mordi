package com.mordi.backend.service;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deletion against a real PostgreSQL migrated by Flyway: the cascades live in
 * the schema, so only a real database can show that everything goes and that
 * nobody else's data is caught in it. Each test's rows are rolled back.
 *
 *   MORDI_IT_DB=1 SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mordi \
 *   SPRING_DATASOURCE_PASSWORD=... ./mvnw test -Dtest=AccountDeletionIT
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "MORDI_IT_DB", matches = "1")
class AccountDeletionIT {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(4);

    @Autowired private UserRepository users;
    @Autowired private GoalRepository goals;
    @Autowired private GoalMemberRepository members;
    @Autowired private BehaviorRepository behaviors;
    @Autowired private EntityManager em;
    @Autowired private ApplicationEventPublisher events;

    private AccountService service;
    private User sam;
    private User alex;
    private User jo;

    @BeforeEach
    void setUp() {
        service = new AccountService(users, goals, members, ENCODER, events);
        sam = person("Sam");
        alex = person("Alex");
        jo = person("Jo");
    }

    private User person(String name) {
        User user = new User();
        user.setName(name);
        user.setEmail(name.toLowerCase() + "-" + UUID.randomUUID() + "@it.mordi");
        user.setPassword(ENCODER.encode("password-" + name));
        return users.save(user);
    }

    private Goal goal(User owner, String title) {
        Goal goal = new Goal();
        goal.setUser(owner);
        goal.setTitle(title);
        goal.setTargetPerWeek(3);
        return goals.save(goal);
    }

    private void join(Goal goal, User user) {
        GoalMember m = new GoalMember();
        m.setGoal(goal);
        m.setUser(user);
        members.save(m);
        // joined_at is set on insert; flush so later joins sort after this one.
        em.flush();
    }

    private Behavior entry(User user, Goal goal) {
        Behavior b = new Behavior();
        b.setUser(user);
        b.setGoal(goal);
        b.setNote("done");
        b.setCompleted(true);
        b.setLogDate(LocalDate.of(2026, 10, 1));
        return behaviors.save(b);
    }

    private long count(String sql, Object id) {
        return ((Number) em.createNativeQuery(sql).setParameter(1, id).getSingleResult()).longValue();
    }

    @Test
    void everythingOwnedGoesAndNobodyElsesDataIsTouched() {
        Goal solo = goal(sam, "Solo");
        entry(sam, solo);
        Goal alexs = goal(alex, "Alex's own");
        Behavior alexEntry = entry(alex, alexs);
        em.flush();

        service.delete(sam.getEmail(), "password-Sam");
        em.flush();
        em.clear();

        assertThat(users.findById(sam.getId())).isEmpty();
        assertThat(count("select count(*) from goals where user_id = ?1", sam.getId())).isZero();
        assertThat(count("select count(*) from behaviors where user_id = ?1", sam.getId())).isZero();
        assertThat(behaviors.findById(alexEntry.getId())).isPresent();
        assertThat(goals.findById(alexs.getId())).isPresent();
    }

    @Test
    void aSharedGoalPassesToTheFirstToJoinWithEveryoneElsesEntries() {
        Goal run = goal(sam, "Morning run");
        join(run, sam);
        join(run, alex);
        join(run, jo);
        entry(sam, run);
        Behavior alexRun = entry(alex, run);
        Behavior joRun = entry(jo, run);
        em.flush();

        service.delete(sam.getEmail(), "password-Sam");
        em.flush();
        em.clear();

        Goal kept = goals.findById(run.getId()).orElseThrow();
        assertThat(kept.getUser().getId()).isEqualTo(alex.getId());
        assertThat(behaviors.findById(alexRun.getId()).orElseThrow().getGoal().getId()).isEqualTo(run.getId());
        assertThat(behaviors.findById(joRun.getId())).isPresent();
        assertThat(count("select count(*) from goal_members where goal_id = ?1", run.getId())).isEqualTo(2);
    }

    @Test
    void entriesOfSomeoneWhoLeftStayWhenTheGoalGoes() {
        Goal run = goal(sam, "Morning run");
        // Alex logged against it once, then left: no member row any more.
        Behavior alexRun = entry(alex, run);
        em.flush();

        service.delete(sam.getEmail(), "password-Sam");
        em.flush();
        em.clear();

        assertThat(goals.findById(run.getId())).isEmpty();
        Behavior survivor = behaviors.findById(alexRun.getId()).orElseThrow();
        assertThat(survivor.getGoal()).isNull();
    }
}
