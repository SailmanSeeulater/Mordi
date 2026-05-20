package com.mordi.backend.service;

import com.mordi.backend.dto.GoalRequest;
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
        User user = userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Goal goal = new Goal();
        goal.setUser(user);
        goal.setTitle(request.getTitle());
        goal.setDescription(request.getDescription());
        goal.setFrequency(request.getFrequency());
        goal.setCategory(request.getCategory());

        return goalRepository.save(goal);
    }

    public List<Goal> getActiveGoals(String email) {
        User user = userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return goalRepository.findByUserAndActive(user, true);
    }

    public Goal deactivateGoal(String email, Long goalId) {
        Goal goal = goalRepository
            .findById(goalId)
            .orElseThrow(() -> new RuntimeException("Goal not found"));
        if (!goal.getUser().getEmail().equals(email)) {
            throw new RuntimeException("Unauthorized");
        }

        goal.setActive(false);
        return goalRepository.save(goal);
    }
}
