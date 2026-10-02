package com.mordi.backend.service;

import com.mordi.backend.exception.LinkExpiredException;
import com.mordi.backend.model.User;
import com.mordi.backend.model.UserToken;
import com.mordi.backend.repository.UserTokenRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-time links: a random token that stands for one action on one account,
 * once, for a short while. The raw token goes into the link; only its hash is
 * kept, so a copy of the table is not a set of working links.
 */
@Service
public class UserTokenService {

    private final UserTokenRepository repository;
    private final Clock clock;

    @Autowired
    public UserTokenService(UserTokenRepository repository) {
        this(repository, Clock.systemDefaultZone());
    }

    /** For tests, so expiry can be exercised without waiting. */
    UserTokenService(UserTokenRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * Issues a token, retiring any still outstanding for the same purpose:
     * asking twice leaves one working link, the latest. Returns the raw token.
     */
    @Transactional
    public String issue(User user, UserToken.Purpose purpose, Duration ttl) {
        LocalDateTime now = LocalDateTime.now(clock);
        repository.retireOutstanding(user, purpose, now);

        String raw = Tokens.random();
        UserToken token = new UserToken();
        token.setUser(user);
        token.setPurpose(purpose);
        token.setTokenHash(Tokens.hash(raw));
        token.setCreatedAt(now);
        token.setExpiresAt(now.plus(ttl));
        repository.save(token);
        return raw;
    }

    /**
     * Spends a token and returns whose it was. Unknown, expired, used and
     * wrong-purpose tokens all fail the same way.
     */
    @Transactional
    public User consume(String raw, UserToken.Purpose purpose) {
        if (raw == null || raw.isBlank()) {
            throw new LinkExpiredException();
        }
        UserToken token = repository
            .findByTokenHash(Tokens.hash(raw))
            .orElseThrow(LinkExpiredException::new);
        LocalDateTime now = LocalDateTime.now(clock);
        if (token.getPurpose() != purpose || token.isUsed() || !token.getExpiresAt().isAfter(now)) {
            throw new LinkExpiredException();
        }
        token.setUsedAt(now);
        repository.save(token);
        return token.getUser();
    }
}
