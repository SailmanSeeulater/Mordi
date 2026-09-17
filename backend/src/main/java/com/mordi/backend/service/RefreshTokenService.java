package com.mordi.backend.service;

import com.mordi.backend.exception.InvalidRefreshTokenException;
import com.mordi.backend.model.RefreshToken;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.RefreshTokenRepository;
import com.mordi.backend.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Long-lived sign-in, kept separate from the short-lived access token.
 *
 * The access token is a JWT that expires in minutes and is sent on every
 * request. This is what replaces it when it runs out: a random value, held in
 * an httpOnly cookie that page scripts cannot read, stored here only as a
 * hash, and swapped for a new one every time it is used.
 *
 * Rotation is what makes theft detectable. A legitimate client always
 * presents the newest token in its family. If an already-rotated one turns up
 * instead, two parties hold copies, and there is no way to tell which is the
 * owner — so every token in the family is revoked and both have to sign in.
 */
@Service
public class RefreshTokenService {

    /** 256 bits: not guessable, and far more than a hash collision needs. */
    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository repository;
    private final UserRepository userRepository;
    private final Duration ttl;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    // @Autowired is required, not decoration. With two constructors and neither
    // marked, Spring does not choose one: it looks for a no-argument
    // constructor, finds none, and the application fails to start with
    // NoSuchMethodException: RefreshTokenService.<init>().
    @Autowired
    public RefreshTokenService(
            RefreshTokenRepository repository,
            UserRepository userRepository,
            @Value("${mordi.auth.refresh-ttl-days:30}") long ttlDays) {
        this(repository, userRepository, Duration.ofDays(ttlDays), Clock.systemDefaultZone());
    }

    /** For tests, so expiry can be exercised without waiting. */
    RefreshTokenService(
            RefreshTokenRepository repository,
            UserRepository userRepository,
            Duration ttl,
            Clock clock) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.ttl = ttl;
        this.clock = clock;
    }

    /** The outcome of a successful rotation: who it was, and their next token. */
    public record Rotation(User user, String token) {}

    public Duration ttl() {
        return ttl;
    }

    /** Starts a new family at sign-in. Returns the raw token for the cookie. */
    @Transactional
    public String issueFor(String email) {
        User user = userRepository
            .findByEmail(email)
            .orElseThrow(InvalidRefreshTokenException::new);
        return issue(user, UUID.randomUUID());
    }

    /**
     * Swaps a token for a new one in the same family.
     *
     * Unknown, expired and reused tokens all fail the same way. A reused one
     * also takes the rest of its family with it.
     */
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public Rotation rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidRefreshTokenException();
        }

        RefreshToken current = repository
            .findByTokenHash(hash(rawToken))
            .orElseThrow(InvalidRefreshTokenException::new);
        LocalDateTime now = LocalDateTime.now(clock);

        if (current.isRevoked()) {
            // Already rotated or signed out, and presented again: a copy exists
            // somewhere it should not. The revocation has to survive the
            // exception, hence noRollbackFor above.
            repository.revokeFamily(current.getFamilyId(), now);
            throw new InvalidRefreshTokenException();
        }
        if (!current.getExpiresAt().isAfter(now)) {
            throw new InvalidRefreshTokenException();
        }

        current.setRevokedAt(now);
        repository.save(current);

        String next = issue(current.getUser(), current.getFamilyId());
        return new Rotation(current.getUser(), next);
    }

    /**
     * Signs out this device. A token that is unknown or already revoked is not
     * an error here: the outcome someone signing out wants has happened either
     * way.
     */
    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        repository.findByTokenHash(hash(rawToken)).ifPresent(token -> {
            if (!token.isRevoked()) {
                token.setRevokedAt(LocalDateTime.now(clock));
                repository.save(token);
            }
        });
    }

    private String issue(User user, UUID familyId) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        LocalDateTime now = LocalDateTime.now(clock);
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash(raw));
        token.setFamilyId(familyId);
        token.setCreatedAt(now);
        token.setExpiresAt(now.plus(ttl));
        repository.save(token);

        return raw;
    }

    /**
     * SHA-256, not a password hash. The input is 256 random bits, so there is
     * nothing for a slow hash to protect against, and lookups need to be
     * deterministic.
     */
    static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // Every JVM is required to provide SHA-256.
            throw new IllegalStateException(e);
        }
    }
}
