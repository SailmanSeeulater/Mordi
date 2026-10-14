package com.mordi.backend.service;

import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Remembers the last day each person used Mordi, so the owner can count how
 * many people are active without keeping a log of visits.
 *
 * Only a date is kept (UTC, never a time), only the latest one, and it is
 * written at most once a person a day: a request from someone already marked
 * today does no write at all.
 */
@Service
@Slf4j
public class ActivityService {

    private final UserRepository userRepository;
    private final Clock clock;

    // @Autowired for the same reason as RefreshTokenService: with two
    // constructors and neither marked, Spring cannot choose.
    @Autowired
    public ActivityService(UserRepository userRepository) {
        this(userRepository, Clock.systemUTC());
    }

    /** For tests, so the day can be moved without waiting. */
    ActivityService(UserRepository userRepository, Clock clock) {
        this.userRepository = userRepository;
        this.clock = clock;
    }

    /**
     * Marks this person active today. The account is whatever the caller
     * already loaded: if it already says today, nothing is written, and if it
     * is stale the update's own condition still makes a second write a no-op.
     *
     * Never throws. Counting people is not worth failing their request over.
     */
    public void markActive(User user) {
        try {
            LocalDate today = LocalDate.now(clock);
            if (user == null || user.getId() == null || today.equals(user.getLastActiveOn())) {
                return;
            }
            userRepository.markActiveOn(user.getId(), today);
        } catch (RuntimeException e) {
            log.debug("Could not mark an account active: {}", e.getMessage());
        }
    }
}
