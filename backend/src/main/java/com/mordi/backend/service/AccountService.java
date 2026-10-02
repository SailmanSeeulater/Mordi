package com.mordi.backend.service;

import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import java.util.HashSet;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deleting an account, all at once and for good.
 *
 * Everything the person owns goes with them, by the database's own cascades:
 * goals, entries, places, notes, to-dos, events, reports, sessions, push
 * subscriptions, and what they wrote in shared-goal threads. The one thing
 * that outlives them is a shared goal other people are still in: it passes to
 * whoever joined it first, so their entries and their thread carry on.
 */
@Service
@RequiredArgsConstructor
public class AccountService {

    /** Told to whoever sends the goodbye email, once the deletion has committed. */
    public record AccountDeleted(String email, String name) {}

    private final UserRepository users;
    private final GoalRepository goals;
    private final GoalMemberRepository members;
    private final PasswordEncoder encoder;
    private final ApplicationEventPublisher events;

    @Transactional
    public void delete(String email, String password) {
        User user = users
            .findByEmail(email)
            .orElseThrow(() -> new InvalidCredentialsException("Not signed in"));
        // Asked again even though signed in: a borrowed, unlocked phone
        // should not be enough to erase someone.
        if (password == null || !encoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("Password is incorrect");
        }

        handOverSharedGoals(user);
        users.deleteUserById(user.getId());
        events.publishEvent(new AccountDeleted(user.getEmail(), user.getName()));
    }

    /** Each goal with anyone else still in it goes to the first of them to join. */
    private void handOverSharedGoals(User owner) {
        Set<Long> handedOver = new HashSet<>();
        for (GoalMember heir : members.findOthersInGoalsOwnedBy(owner)) {
            Goal goal = heir.getGoal();
            if (handedOver.add(goal.getId())) {
                goal.setUser(heir.getUser());
                goals.save(goal);
            }
        }
    }
}
