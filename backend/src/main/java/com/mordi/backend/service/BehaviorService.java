package com.mordi.backend.service;

import com.mordi.backend.dto.BehaviorRequest;
import com.mordi.backend.dto.PlaceSummary;
import com.mordi.backend.exception.BehaviorNotFoundException;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Location;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.LocationRepository;
import com.mordi.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BehaviorService {

    private final BehaviorRepository behaviorRepository;
    private final UserRepository userRepository;
    private final LocationRepository locationRepository;
    private final GoalAccess goalAccess;

    public Behavior logBehavior(String email, BehaviorRequest request) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));


        Behavior behavior = new Behavior();
        behavior.setUser(user);
        behavior.setNote(request.getNote());
        behavior.setCompleted(request.isCompleted());
        behavior.setMood(request.getMood());
        behavior.setLogDate(request.getLogDate() != null ? request.getLogDate() : LocalDate.now());


        if (request.getGoalId() != null) {
            // Your own goal, or a shared one you have joined: each person's
            // entries stay theirs either way.
            behavior.setGoal(goalAccess.joined(user, request.getGoalId()));
        }

        // A place name on its own is fine — "the gym" carried over from the
        // goal has no coordinates behind it.
        behavior.setPlaceName(trimToNull(request.getPlaceName()));
        behavior.setLatitude(request.getLatitude());
        behavior.setLongitude(request.getLongitude());
        behavior.setDurationSeconds(validDuration(request.getDurationSeconds()));
        behavior.setLoggedAt(validLoggedAt(request.getLoggedAt()));

        Behavior saved = behaviorRepository.save(behavior);

        // A real fix also joins the locations history, so the Places map shows
        // where the week actually happened rather than only the fixes captured
        // from that page.
        if (request.getLatitude() != null && request.getLongitude() != null) {
            Location location = new Location();
            location.setUser(user);
            location.setLatitude(request.getLatitude());
            location.setLongitude(request.getLongitude());
            location.setPlaceName(behavior.getPlaceName());
            locationRepository.save(location);
        }

        return saved;
    }


    /**
     * A week is the longest single session accepted. Anything longer is a
     * timer left running by mistake, and saving it would put a week of a
     * person's time into one line of their feed.
     */
    static final int MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;

    private Integer validDuration(Integer seconds) {
        if (seconds == null) {
            return null;
        }
        if (seconds < 0 || seconds > MAX_DURATION_SECONDS) {
            throw new IllegalArgumentException("A timed entry must be between 0 seconds and 7 days");
        }
        return seconds;
    }

    /**
     * A client-supplied moment is accepted only when it is plausible: not in
     * the future (allowing for a slow clock) and no older than the longest
     * session plus a day. Anything else is replaced by now, rather than
     * rejecting the whole entry over its timestamp.
     */
    private Instant validLoggedAt(Instant requested) {
        Instant now = Instant.now();
        if (requested == null
                || requested.isAfter(now.plus(Duration.ofMinutes(5)))
                || requested.isBefore(now.minusSeconds(MAX_DURATION_SECONDS).minus(Duration.ofDays(1)))) {
            return now;
        }
        return requested;
    }

    /** Removes one of the person's own entries: the undo for a one-tap log. */
    public void deleteBehavior(String email, Long id) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
        Behavior behavior = behaviorRepository.findByIdAndUser(id, user)
                    .orElseThrow(BehaviorNotFoundException::new);
        behaviorRepository.delete(behavior);
    }

    /** Every named place the person has logged from, most visited first. */
    public List<PlaceSummary> getPlaces(String email) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
        return behaviorRepository.summarizePlaces(user).stream()
            .map(row -> new PlaceSummary(
                (String) row[0],
                ((Number) row[1]).longValue(),
                (LocalDate) row[2],
                row[3] == null ? null : ((Number) row[3]).doubleValue(),
                row[4] == null ? null : ((Number) row[4]).doubleValue()))
            .toList();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public List<Behavior> getTodayBehaviors(String email) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
        return behaviorRepository.findByUserAndLogDate(user, LocalDate.now());
    }

    public List<Behavior> getBehaviorsByDateRange(String email, LocalDate start, LocalDate end) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
        return behaviorRepository.findByUserAndLogDateBetween(user, start, end);
    }
}
