package com.mordi.backend.service;

import com.mordi.backend.dto.PlanEventRequest;
import com.mordi.backend.exception.PlanEventNotFoundException;
import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.PlanEventRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlanEventServiceTest {

    private static final String ME = "sailor@mordi.com";
    private static final LocalDateTime NINE = LocalDateTime.of(2026, 9, 18, 9, 0);

    @Mock private PlanEventRepository repository;
    @Mock private UserRepository userRepository;
    @Mock private BehaviorService behaviorService;

    private PlanEventService service;
    private User me;

    @BeforeEach
    void setUp() {
        service = new PlanEventService(repository, userRepository, behaviorService);
        me = new User();
        me.setEmail(ME);
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(repository.save(any(PlanEvent.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static PlanEventRequest request(String title, LocalDateTime start, LocalDateTime end) {
        PlanEventRequest r = new PlanEventRequest();
        r.setTitle(title);
        r.setStartsAt(start);
        r.setEndsAt(end);
        return r;
    }

    @Test
    void createsATimedEventForItsOwner() {
        PlanEvent event = service.createEvent(ME, request("  Gym  ", NINE, NINE.plusHours(1)));

        assertThat(event.getTitle()).isEqualTo("Gym");
        assertThat(event.getUser()).isSameAs(me);
        assertThat(event.getEndsAt()).isEqualTo(NINE.plusHours(1));
    }

    @Test
    void refusesAMissingTitleOrABackwardsRange() {
        assertThatThrownBy(() -> service.createEvent(ME, request(" ", NINE, NINE.plusHours(1))))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.createEvent(ME, request("Gym", NINE, NINE)))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.createEvent(ME, request("Gym", NINE, NINE.minusMinutes(1))))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.createEvent(ME, request("Gym", NINE, null)))
            .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void refusesARunawayLength() {
        assertThatThrownBy(() -> service.createEvent(ME, request("Trip", NINE, NINE.plusDays(40))))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void snapsAllDayEventsToWholeDays() {
        PlanEventRequest r = request("Conference", NINE, NINE.plusHours(2));
        r.setAllDay(true);

        PlanEvent event = service.createEvent(ME, r);

        // One day: the 18th at midnight to the 19th at midnight.
        assertThat(event.getStartsAt()).isEqualTo(LocalDate.of(2026, 9, 18).atStartOfDay());
        assertThat(event.getEndsAt()).isEqualTo(LocalDate.of(2026, 9, 19).atStartOfDay());
    }

    @Test
    void keepsAMultiDayAllDayEventThatAlreadyEndsAtMidnight() {
        PlanEventRequest r = request("Trip",
            LocalDate.of(2026, 9, 18).atStartOfDay(), LocalDate.of(2026, 9, 21).atStartOfDay());
        r.setAllDay(true);

        assertThat(service.createEvent(ME, r).getEndsAt()).isEqualTo(LocalDate.of(2026, 9, 21).atStartOfDay());
    }

    @Test
    void acceptsOnlyThePalettesColours() {
        PlanEventRequest r = request("Gym", NINE, NINE.plusHours(1));
        r.setColor("sage");
        assertThat(service.createEvent(ME, r).getColor()).isEqualTo("sage");

        r.setColor("#ff0000; background:url(x)");
        assertThatThrownBy(() -> service.createEvent(ME, r)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateChangesOnlyWhatWasSent() {
        PlanEvent existing = service.createEvent(ME, request("Gym", NINE, NINE.plusHours(1)));
        when(repository.findByIdAndUser(5L, me)).thenReturn(Optional.of(existing));
        PlanEventRequest move = new PlanEventRequest();
        move.setStartsAt(NINE.plusHours(2));
        move.setEndsAt(NINE.plusHours(3));

        PlanEvent moved = service.updateEvent(ME, 5L, move);

        assertThat(moved.getTitle()).isEqualTo("Gym");
        assertThat(moved.getStartsAt()).isEqualTo(NINE.plusHours(2));
    }

    @Test
    void someoneElsesEventIsNotFound() {
        when(repository.findByIdAndUser(5L, me)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateEvent(ME, 5L, new PlanEventRequest()))
            .isInstanceOf(PlanEventNotFoundException.class);
        assertThatThrownBy(() -> service.deleteEvent(ME, 5L))
            .isInstanceOf(PlanEventNotFoundException.class);
        verify(repository, never()).delete(any());
    }

    @Test
    void readsEventsOverlappingTheWholeRange() {
        LocalDate mon = LocalDate.of(2026, 9, 14);
        LocalDate sun = LocalDate.of(2026, 9, 20);

        service.getEvents(ME, mon, sun);

        // Overlap, not containment: ends after Monday 00:00, starts before the
        // Monday after, so an event running in from last week is included.
        verify(repository).findByUserAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(
            me, LocalDate.of(2026, 9, 21).atStartOfDay(), mon.atStartOfDay());
    }

    @Test
    @SuppressWarnings("unchecked")
    void importKeepsGoodEventsAndCountsBadOnes() {
        PlanEventRequest bad = request("Backwards", NINE, NINE.minusHours(1));
        PlanEventRequest untitled = request(" ", NINE, NINE.plusHours(1));
        var result = service.importEvents(ME, java.util.List.of(
            request("Gym", NINE, NINE.plusHours(1)), bad, untitled, request("Read", NINE, NINE.plusMinutes(30))));

        assertThat(result).containsEntry("imported", 2).containsEntry("skipped", 2);
        org.mockito.ArgumentCaptor<java.util.List<PlanEvent>> saved = org.mockito.ArgumentCaptor.forClass(java.util.List.class);
        verify(repository).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(PlanEvent::getTitle).containsExactly("Gym", "Read");
    }

    @Test
    void importRefusesAnEmptyOrOversizedFile() {
        assertThatThrownBy(() -> service.importEvents(ME, java.util.List.of()))
            .isInstanceOf(IllegalArgumentException.class);
        var tooMany = java.util.Collections.nCopies(501, request("x", NINE, NINE.plusHours(1)));
        assertThatThrownBy(() -> service.importEvents(ME, tooMany))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void doneLogsAnEntryNamedAndTimedLikeTheEvent() {
        PlanEvent event = service.createEvent(ME, request("Deep work", NINE, NINE.plusMinutes(90)));
        when(repository.findByIdAndUser(5L, me)).thenReturn(Optional.of(event));
        com.mordi.backend.model.Behavior logged = new com.mordi.backend.model.Behavior();
        logged.setId(77L);
        when(behaviorService.logBehavior(eq(ME), any())).thenReturn(logged);
        com.mordi.backend.dto.EventOutcomeRequest done = new com.mordi.backend.dto.EventOutcomeRequest();
        done.setOutcome("done");
        done.setGoalId(3L);

        PlanEvent answered = service.setOutcome(ME, 5L, done);

        org.mockito.ArgumentCaptor<com.mordi.backend.dto.BehaviorRequest> entry =
            org.mockito.ArgumentCaptor.forClass(com.mordi.backend.dto.BehaviorRequest.class);
        verify(behaviorService).logBehavior(eq(ME), entry.capture());
        assertThat(entry.getValue().getNote()).isEqualTo("Deep work");
        assertThat(entry.getValue().getLogDate()).isEqualTo(NINE.toLocalDate());
        assertThat(entry.getValue().getDurationSeconds()).isEqualTo(90 * 60);
        assertThat(entry.getValue().getGoalId()).isEqualTo(3L);
        assertThat(answered.getOutcome()).isEqualTo("done");
        assertThat(answered.getBehaviorId()).isEqualTo(77L);
    }

    @Test
    void answeringAgainOrClearingRemovesTheLoggedEntry() {
        PlanEvent event = service.createEvent(ME, request("Gym", NINE, NINE.plusHours(1)));
        event.setOutcome("done");
        event.setBehaviorId(77L);
        when(repository.findByIdAndUser(5L, me)).thenReturn(Optional.of(event));
        com.mordi.backend.dto.EventOutcomeRequest skipped = new com.mordi.backend.dto.EventOutcomeRequest();
        skipped.setOutcome("skipped");

        PlanEvent answered = service.setOutcome(ME, 5L, skipped);

        verify(behaviorService).deleteBehavior(ME, 77L);
        verify(behaviorService, never()).logBehavior(any(), any());
        assertThat(answered.getOutcome()).isEqualTo("skipped");
        assertThat(answered.getBehaviorId()).isNull();

        assertThat(service.clearOutcome(ME, 5L).getOutcome()).isNull();
    }

    @Test
    void refusesAnUnknownOutcome() {
        when(repository.findByIdAndUser(5L, me)).thenReturn(Optional.of(new PlanEvent()));
        com.mordi.backend.dto.EventOutcomeRequest maybe = new com.mordi.backend.dto.EventOutcomeRequest();
        maybe.setOutcome("maybe");
        assertThatThrownBy(() -> service.setOutcome(ME, 5L, maybe)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void refusesAnInvertedOrOversizedRange() {
        LocalDate day = LocalDate.of(2026, 9, 14);
        assertThatThrownBy(() -> service.getEvents(ME, day, day.minusDays(1)))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.getEvents(ME, day, day.plusDays(100)))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
