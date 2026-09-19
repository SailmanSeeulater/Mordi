package com.mordi.backend.service;

import com.mordi.backend.dto.ArchivedGoalResponse;
import com.mordi.backend.dto.GoalRequest;
import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;
    private final BehaviorRepository behaviorRepository;

    public Goal createGoal(String email, GoalRequest request) {
        User user = findUser(email);

        Goal goal = new Goal();
        goal.setUser(user);
        goal.setTitle(request.getTitle());
        goal.setDescription(request.getDescription());
        goal.setFrequency(request.getFrequency());
        goal.setCategory(request.getCategory());
        goal.setTargetPerWeek(validTarget(request.getTargetPerWeek(), 1));
        goal.setPlaceName(blankToNull(request.getPlaceName()));

        return goalRepository.save(goal);
    }

    public List<Goal> getActiveGoals(String email) {
        return goalRepository.findByUserAndActiveTrueAndArchivedAtIsNull(findUser(email));
    }

    public Goal updateGoal(String email, Long goalId, GoalRequest request) {
        Goal goal = findOwnedGoal(email, goalId);

        if (request.getTitle() != null) {
            goal.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            goal.setDescription(request.getDescription());
        }
        if (request.getFrequency() != null) {
            goal.setFrequency(request.getFrequency());
        }
        // Category is clearable, so an explicitly empty value removes it.
        if (request.getCategory() != null) {
            goal.setCategory(request.getCategory().isBlank() ? null : request.getCategory());
        }
        goal.setTargetPerWeek(validTarget(request.getTargetPerWeek(), goal.getTargetPerWeek()));
        // Like category, the usual place is clearable: an explicitly empty
        // value removes it, a missing one leaves it alone.
        if (request.getPlaceName() != null) {
            goal.setPlaceName(blankToNull(request.getPlaceName()));
        }

        return goalRepository.save(goal);
    }

    public Goal deactivateGoal(String email, Long goalId) {
        Goal goal = findOwnedGoal(email, goalId);
        goal.setActive(false);
        return goalRepository.save(goal);
    }

    /** Off the dashboard and onto History. Archiving twice keeps the first date. */
    public Goal archiveGoal(String email, Long goalId) {
        Goal goal = findOwnedGoal(email, goalId);
        if (goal.getArchivedAt() == null) {
            goal.setArchivedAt(LocalDateTime.now());
        }
        return goalRepository.save(goal);
    }

    /** Back from History to the dashboard, entries and all. */
    public Goal restoreGoal(String email, Long goalId) {
        Goal goal = findOwnedGoal(email, goalId);
        goal.setArchivedAt(null);
        return goalRepository.save(goal);
    }

    /**
     * Archived goals, most recent first, each with what was logged against it.
     * One grouped query for all of them, not one per goal.
     */
    public List<ArchivedGoalResponse> getArchivedGoals(String email) {
        User user = findUser(email);
        List<Goal> goals = goalRepository.findByUserAndActiveTrueAndArchivedAtIsNotNullOrderByArchivedAtDesc(user);
        if (goals.isEmpty()) {
            return List.of();
        }
        Map<Long, Object[]> stats = new HashMap<>();
        for (Object[] row : behaviorRepository.summarizeByGoal(user, goals.stream().map(Goal::getId).toList())) {
            stats.put((Long) row[0], row);
        }
        return goals.stream().map(goal -> {
            Object[] row = stats.get(goal.getId());
            return new ArchivedGoalResponse(
                goal.getId(),
                goal.getTitle(),
                goal.getCategory(),
                goal.getTargetPerWeek(),
                goal.getPlaceName(),
                goal.getCreatedAt(),
                goal.getArchivedAt(),
                row == null ? 0 : ((Number) row[1]).longValue(),
                row == null || row[2] == null ? 0 : ((Number) row[2]).longValue(),
                row == null ? null : (LocalDate) row[3],
                row == null ? null : (LocalDate) row[4]);
        }).toList();
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Goals belonging to someone else are reported exactly like goals that do not
     * exist, so ids from other accounts cannot be probed.
     */
    private Goal findOwnedGoal(String email, Long goalId) {
        return goalRepository
            .findById(goalId)
            .filter(goal -> goal.isActive() && goal.getUser().getEmail().equals(email))
            .orElseThrow(GoalNotFoundException::new);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private int validTarget(Integer requested, int fallback) {
        if (requested == null) {
            return fallback;
        }
        if (requested < 1 || requested > 7) {
            throw new RuntimeException("targetPerWeek must be between 1 and 7");
        }
        return requested;
    }
}
