package com.mordi.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.CalendarFeed;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.GoalMessage;
import com.mordi.backend.model.Note;
import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.CalendarFeedRepository;
import com.mordi.backend.repository.CategoryRepository;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalMessageRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.LocationRepository;
import com.mordi.backend.repository.NoteRepository;
import com.mordi.backend.repository.PlanEventRepository;
import com.mordi.backend.repository.PushSubscriptionRepository;
import com.mordi.backend.repository.ReportRepository;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.AccountExportService.AccountExport;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountExportServiceTest {

    @Mock private UserRepository users;
    @Mock private GoalRepository goals;
    @Mock private BehaviorRepository behaviors;
    @Mock private LocationRepository locations;
    @Mock private CategoryRepository categories;
    @Mock private NoteRepository notes;
    @Mock private TodoRepository todos;
    @Mock private PlanEventRepository events;
    @Mock private ReportRepository reports;
    @Mock private GoalMemberRepository members;
    @Mock private GoalMessageRepository messages;
    @Mock private CalendarFeedRepository feeds;
    @Mock private PushSubscriptionRepository pushSubscriptions;

    private AccountExportService service;
    private User me;
    private User alex;

    @BeforeEach
    void setUp() {
        service = new AccountExportService(
            users, goals, behaviors, locations, categories, notes, todos, events, reports,
            members, messages, feeds, pushSubscriptions);
        me = person(1L, "me@mordi.com", "Me");
        me.setPassword("$2a$10$secret-hash");
        alex = person(2L, "alex@mordi.com", "Alex");
    }

    private static User person(Long id, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName(name);
        return user;
    }

    private static Goal goal(Long id, User owner, String title) {
        Goal goal = new Goal();
        goal.setId(id);
        goal.setUser(owner);
        goal.setTitle(title);
        return goal;
    }

    private void signedIn() {
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(me));
    }

    @Test
    void includesWhatTheOldClientSideExportMissed() {
        signedIn();
        Goal run = goal(10L, me, "Run");
        run.setPlannedDays((short) 0b000_0101);
        when(goals.findByUserOrderByIdAsc(me)).thenReturn(List.of(run));

        Behavior entry = new Behavior();
        entry.setId(100L);
        entry.setGoal(run);
        entry.setCompleted(true);
        entry.setLogDate(LocalDate.of(2026, 10, 1));
        when(behaviors.findByUserOrderByLogDateAscIdAsc(me)).thenReturn(List.of(entry));

        Note note = new Note();
        note.setTitle("Shoes");
        note.setBody("Size 10");
        when(notes.findByUserOrderByPinnedDescUpdatedAtDesc(me)).thenReturn(List.of(note));

        Todo cleared = new Todo();
        cleared.setText("Book dentist");
        cleared.setDone(true);
        cleared.setClearedAt(Instant.parse("2026-10-02T09:00:00Z"));
        when(todos.findByUserOrderByCreatedAtAsc(me)).thenReturn(List.of(cleared));

        PlanEvent imported = new PlanEvent();
        imported.setTitle("Standup");
        imported.setStartsAt(LocalDateTime.of(2026, 10, 5, 9, 0));
        imported.setEndsAt(LocalDateTime.of(2026, 10, 5, 9, 15));
        imported.setFeedId(7L);
        when(events.findByUserOrderByStartsAtAsc(me)).thenReturn(List.of(imported));

        Goal shared = goal(20L, alex, "Read together");
        GoalMember membership = new GoalMember();
        membership.setGoal(shared);
        membership.setUser(me);
        when(members.findByUserOrderByJoinedAtAsc(me)).thenReturn(List.of(membership));

        GoalMessage said = new GoalMessage();
        said.setGoal(shared);
        said.setUser(me);
        said.setBody("Chapter 3 done");
        when(messages.findByUserOrderByIdAsc(me)).thenReturn(List.of(said));
        when(pushSubscriptions.countByUser(me)).thenReturn(2L);

        AccountExport export = service.export("me@mordi.com");

        assertThat(export.account().email()).isEqualTo("me@mordi.com");
        assertThat(export.goals()).singleElement().satisfies(g -> {
            assertThat(g.title()).isEqualTo("Run");
            assertThat(g.plannedDays()).containsExactly("MONDAY", "WEDNESDAY");
            assertThat(g.removed()).isFalse();
        });
        assertThat(export.entries()).singleElement().satisfies(e -> {
            assertThat(e.goalId()).isEqualTo(10L);
            assertThat(e.goalTitle()).isEqualTo("Run");
        });
        assertThat(export.notes()).singleElement().extracting(AccountExportService.NoteRow::body).isEqualTo("Size 10");
        assertThat(export.todos()).singleElement().extracting(AccountExportService.TodoRow::text).isEqualTo("Book dentist");
        assertThat(export.events()).singleElement().satisfies(e -> assertThat(e.fromConnectedCalendar()).isTrue());
        assertThat(export.sharedGoals()).singleElement().satisfies(s -> {
            assertThat(s.goalTitle()).isEqualTo("Read together");
            assertThat(s.yours()).isFalse();
        });
        assertThat(export.messages()).singleElement().satisfies(m -> {
            assertThat(m.goalTitle()).isEqualTo("Read together");
            assertThat(m.body()).isEqualTo("Chapter 3 done");
        });
        assertThat(export.devicesWithReminders()).isEqualTo(2L);
    }

    @Test
    void leavesOutSecrets() throws Exception {
        signedIn();
        CalendarFeed feed = new CalendarFeed();
        feed.setName("Work");
        feed.setUrlCiphertext("ciphertext-of-the-private-address");
        feed.setUrlHash("hash-of-the-private-address");
        feed.setEventCount(12);
        when(feeds.findByUserOrderByIdAsc(me)).thenReturn(List.of(feed));

        AccountExport export = service.export("me@mordi.com");
        String json = new ObjectMapper().registerModule(new JavaTimeModule()).writeValueAsString(export);

        assertThat(export.connectedCalendars()).singleElement().satisfies(c -> {
            assertThat(c.name()).isEqualTo("Work");
            assertThat(c.eventCount()).isEqualTo(12);
        });
        assertThat(json).doesNotContain("secret-hash", "private-address", "password");
    }

    @Test
    void noPlannedDaysIsAnEmptyList() {
        assertThat(AccountExportService.dayNames(null)).isEmpty();
        assertThat(AccountExportService.dayNames((short) 0b100_0000)).containsExactly("SUNDAY");
    }

    @Test
    void refusesWhenTheAccountIsGone() {
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.export("me@mordi.com"))
            .isInstanceOf(InvalidCredentialsException.class);
    }
}
