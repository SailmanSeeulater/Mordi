package com.mordi.backend.service;

import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Settings kept on the account rather than in one browser, because the
 * server counts with them too. For now that is the day the week starts on.
 */
@Service
@RequiredArgsConstructor
public class PreferencesService {

    /** "monday" or "sunday". A field left out of an update is left as it is. */
    public record Preferences(String weekStart) {
    }

    private final UserRepository users;

    public Preferences get(String email) {
        return of(findUser(email));
    }

    @Transactional
    public Preferences update(String email, Preferences request) {
        User user = findUser(email);
        if (request.weekStart() != null) {
            user.setWeekStart(Weeks.valid(request.weekStart()));
        }
        return of(users.save(user));
    }

    private static Preferences of(User user) {
        return new Preferences(user.getWeekStart());
    }

    private User findUser(String email) {
        return users.findByEmail(email)
            .orElseThrow(() -> new InvalidCredentialsException("Not signed in"));
    }
}
