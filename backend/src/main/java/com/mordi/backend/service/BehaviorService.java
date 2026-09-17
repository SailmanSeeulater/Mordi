package com.mordi.backend.service;

import com.mordi.backend.dto.BehaviorRequest;
import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.Location;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.LocationRepository;
import com.mordi.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BehaviorService {

    private final BehaviorRepository behaviorRepository;
    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final LocationRepository locationRepository;

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
            Goal goal = goalRepository.findById(request.getGoalId())
                        .filter(g -> g.isActive() && g.getUser().getEmail().equals(email))
                        .orElseThrow(GoalNotFoundException::new);
            behavior.setGoal(goal);
        }

        // A place name on its own is fine — "the gym" carried over from the
        // goal has no coordinates behind it.
        behavior.setPlaceName(trimToNull(request.getPlaceName()));
        behavior.setLatitude(request.getLatitude());
        behavior.setLongitude(request.getLongitude());
        behavior.setDurationSeconds(validDuration(request.getDurationSeconds()));

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
