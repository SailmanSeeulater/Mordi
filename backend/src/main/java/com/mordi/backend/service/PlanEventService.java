package com.mordi.backend.service;

import com.mordi.backend.dto.BehaviorRequest;
import com.mordi.backend.dto.EventOutcomeRequest;
import com.mordi.backend.dto.PlanEventRequest;
import com.mordi.backend.exception.BehaviorNotFoundException;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.exception.PlanEventNotFoundException;
import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.PlanEventRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The calendar: planned events, as opposed to entries, which record what was
 * done. Every rule the calendar relies on is checked here, not only in the
 * browser: a title, an end after the start, and sane sizes.
 */
@Service
@RequiredArgsConstructor
public class PlanEventService {

    static final int MAX_TITLE = 120;
    static final int MAX_NOTES = 1000;
    static final int MAX_PLACE = 255;
    /** Longest single event. Anything longer is a typo, not a plan. */
    static final Duration MAX_LENGTH = Duration.ofDays(31);
    /** Widest range one read may ask for: a month view plus its edges. */
    static final int MAX_RANGE_DAYS = 62;
    /** Most events one import may carry: a year of a busy calendar. */
    static final int MAX_IMPORT = 500;
    /** The calendar's palette, by name, so each theme decides the actual colour. */
    static final Set<String> COLORS = Set.of("accent", "sky", "sage", "amber", "rose", "violet", "slate");

    private final PlanEventRepository repository;
    private final UserRepository userRepository;
    private final BehaviorService behaviorService;

    /** Events overlapping the days start..end, both inclusive. */
    public List<PlanEvent> getEvents(String email, LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start)) {
            throw new IllegalArgumentException("end must be on or after start");
        }
        if (start.plusDays(MAX_RANGE_DAYS).isBefore(end)) {
            throw new IllegalArgumentException("Ask for at most " + MAX_RANGE_DAYS + " days at a time");
        }
        return repository.findByUserAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(
            findUser(email), end.plusDays(1).atStartOfDay(), start.atStartOfDay());
    }

    public PlanEvent createEvent(String email, PlanEventRequest request) {
        PlanEvent event = new PlanEvent();
        event.setUser(findUser(email));
        apply(event, request, true);
        return repository.save(event);
    }

    /** A partial update: fields left out keep their values. */
    public PlanEvent updateEvent(String email, Long id, PlanEventRequest request) {
        PlanEvent event = findOwned(email, id);
        apply(event, request, false);
        return repository.save(event);
    }

    /**
     * Many events at once, from a calendar file. Each is held to exactly the
     * rules a single event is; one that breaks them is skipped and counted
     * rather than failing the whole file. Saved in one transaction, so an
     * import either lands whole or not at all.
     */
    @Transactional
    public Map<String, Integer> importEvents(String email, List<PlanEventRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("Nothing to import");
        }
        if (requests.size() > MAX_IMPORT) {
            throw new IllegalArgumentException("Import at most " + MAX_IMPORT + " events at a time");
        }
        User user = findUser(email);
        List<PlanEvent> events = new ArrayList<>();
        int skipped = 0;
        for (PlanEventRequest request : requests) {
            PlanEvent event = new PlanEvent();
            event.setUser(user);
            try {
                apply(event, request, true);
                events.add(event);
            } catch (IllegalArgumentException ex) {
                skipped++;
            }
        }
        repository.saveAll(events);
        return Map.of("imported", events.size(), "skipped", skipped);
    }

    /**
     * Answers "did it happen?". Done logs an ordinary entry for it, through
     * the same rules as any other entry: named after the event, dated the day
     * it started, with the event's length as its duration when it was timed.
     * Answering again replaces the earlier answer, entry included.
     */
    @Transactional
    public PlanEvent setOutcome(String email, Long id, EventOutcomeRequest request) {
        PlanEvent event = findOwned(email, id);
        String outcome = request == null ? null : request.getOutcome();
        if (!"done".equals(outcome) && !"skipped".equals(outcome)) {
            throw new IllegalArgumentException("Outcome must be done or skipped");
        }
        removeLinkedEntry(email, event);
        if ("done".equals(outcome)) {
            BehaviorRequest entry = new BehaviorRequest();
            entry.setNote(event.getTitle());
            entry.setCompleted(true);
            entry.setLogDate(event.getStartsAt().toLocalDate());
            entry.setGoalId(request.getGoalId());
            entry.setMood(request.getMood());
            entry.setPlaceName(event.getPlaceName());
            if (!event.isAllDay()) {
                long seconds = Duration.between(event.getStartsAt(), event.getEndsAt()).getSeconds();
                if (seconds > 0 && seconds <= BehaviorService.MAX_DURATION_SECONDS) {
                    entry.setDurationSeconds((int) seconds);
                }
            }
            Behavior logged = behaviorService.logBehavior(email, entry);
            event.setBehaviorId(logged.getId());
        }
        event.setOutcome(outcome);
        return repository.save(event);
    }

    /** Takes the answer back, removing the entry it logged if there was one. */
    @Transactional
    public PlanEvent clearOutcome(String email, Long id) {
        PlanEvent event = findOwned(email, id);
        removeLinkedEntry(email, event);
        event.setOutcome(null);
        return repository.save(event);
    }

    private void removeLinkedEntry(String email, PlanEvent event) {
        if (event.getBehaviorId() != null) {
            try {
                behaviorService.deleteBehavior(email, event.getBehaviorId());
            } catch (BehaviorNotFoundException gone) {
                // Already deleted by hand: nothing left to undo.
            }
            event.setBehaviorId(null);
        }
    }

    public void deleteEvent(String email, Long id) {
        repository.delete(findOwned(email, id));
    }

    private void apply(PlanEvent event, PlanEventRequest request, boolean creating) {
        if (creating || request.getTitle() != null) {
            String title = request.getTitle() == null ? "" : request.getTitle().trim();
            if (title.isEmpty()) {
                throw new IllegalArgumentException("An event needs a title");
            }
            event.setTitle(clamp(title, MAX_TITLE));
        }
        if (request.getNotes() != null) {
            event.setNotes(blankToNull(clamp(request.getNotes().trim(), MAX_NOTES)));
        }
        if (request.getPlaceName() != null) {
            event.setPlaceName(blankToNull(clamp(request.getPlaceName().trim(), MAX_PLACE)));
        }
        if (request.getColor() != null) {
            String color = request.getColor().isBlank() ? null : request.getColor();
            if (color != null && !COLORS.contains(color)) {
                throw new IllegalArgumentException("Unknown colour: " + color);
            }
            event.setColor(color);
        }
        if (request.getAllDay() != null) {
            event.setAllDay(request.getAllDay());
        }
        if (creating || request.getStartsAt() != null) {
            if (request.getStartsAt() == null) {
                throw new IllegalArgumentException("An event needs a start time");
            }
            event.setStartsAt(request.getStartsAt());
        }
        if (creating || request.getEndsAt() != null) {
            if (request.getEndsAt() == null) {
                throw new IllegalArgumentException("An event needs an end time");
            }
            event.setEndsAt(request.getEndsAt());
        }
        // All-day events cover whole days: snap both ends to midnight, so the
        // rest of the calendar never has to decide what a 3pm all-day event is.
        if (event.isAllDay()) {
            LocalDate firstDay = event.getStartsAt().toLocalDate();
            LocalDate endDay = event.getEndsAt().toLocalDate();
            boolean endsAtMidnight = event.getEndsAt().toLocalTime().equals(LocalTime.MIDNIGHT);
            if (!endsAtMidnight || !endDay.isAfter(firstDay)) {
                endDay = endDay.plusDays(1);
            }
            event.setStartsAt(firstDay.atStartOfDay());
            event.setEndsAt(endDay.atStartOfDay());
        }
        if (!event.getEndsAt().isAfter(event.getStartsAt())) {
            throw new IllegalArgumentException("An event must end after it starts");
        }
        if (Duration.between(event.getStartsAt(), event.getEndsAt()).compareTo(MAX_LENGTH) > 0) {
            throw new IllegalArgumentException("An event can last at most 31 days");
        }
    }

    /** Someone else's event is reported exactly like one that does not exist. */
    private PlanEvent findOwned(String email, Long id) {
        return repository.findByIdAndUser(id, findUser(email))
            .orElseThrow(PlanEventNotFoundException::new);
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private static String clamp(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
