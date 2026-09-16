package com.mordi.backend.service;

import com.mordi.backend.dto.GoalRequest;
import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;

    public Goal createGoal(String email, GoalRequest request) {
        User user = findUser(email);

        Goal goal = new Goal();
        goal.setUser(user);
        goal.setTitle(request.getTitle());
        goal.setDescription(request.getDescription());
        goal.setFrequency(request.getFrequency());
        goal.setCategory(request.getCategory());
        goal.setTargetPerWeek(validTarget(request.getTargetPerWeek(), 1));

        return goalRepository.save(goal);
    }

    public List<Goal> getActiveGoals(String email) {
        return goalRepository.findByUserAndActive(findUser(email), true);
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

        return goalRepository.save(goal);
    }

    public Goal deactivateGoal(String email, Long goalId) {
        Goal goal = findOwnedGoal(email, goalId);
        goal.setActive(false);
        return goalRepository.save(goal);
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
