package com.mordi.backend.service;

import com.mordi.backend.dto.BehaviorRequest;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
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
                        .orElseThrow(() -> new RuntimeException("Goal not found"));
            behavior.setGoal(goal);
        }

        return behaviorRepository.save(behavior);
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
