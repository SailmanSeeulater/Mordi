package com.mordi.backend.service;

import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Who may touch which goal, in one place. Before shared goals, every check
 * was "is this row mine"; now a goal can also be one the person has joined,
 * and a check missed in any one service would leak someone else's goal. So
 * the question is asked here and nowhere else.
 *
 * Anything the person may not see is reported exactly as a goal that does not
 * exist, so ids from other accounts cannot be probed.
 */
@Component
@RequiredArgsConstructor
public class GoalAccess {

    private final GoalRepository goalRepository;
    private final GoalMemberRepository memberRepository;

    /** A current goal the person owns or has joined. */
    public Goal joined(User user, Long goalId) {
        return goalRepository
            .findById(goalId)
            .filter(goal -> goal.isActive() && (isOwner(goal, user) || memberRepository.existsByGoalAndUser(goal, user)))
            .orElseThrow(GoalNotFoundException::new);
    }

    /** A current goal the person owns: inviting, removing people, ending it. */
    public Goal owned(User user, Long goalId) {
        return goalRepository
            .findById(goalId)
            .filter(goal -> goal.isActive() && isOwner(goal, user))
            .orElseThrow(GoalNotFoundException::new);
    }

    public static boolean isOwner(Goal goal, User user) {
        return sameUser(goal.getUser(), user);
    }

    /** By email, which is unique and always loaded, as the rest of the services compare. */
    public static boolean sameUser(User a, User b) {
        return a != null && b != null && a.getEmail() != null && a.getEmail().equals(b.getEmail());
    }
}
