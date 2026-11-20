package com.mordi.backend.service;

import com.mordi.backend.config.JwtUtil;
import com.mordi.backend.dto.AuthRequest;
import com.mordi.backend.dto.AuthResponse;
import com.mordi.backend.dto.GuestRequest;
import com.mordi.backend.exception.EmailAlreadyExistsException;
import com.mordi.backend.exception.GuestsFullException;
import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Try it": an account made without an email or a password, so someone can
 * use the real app before deciding to sign up.
 *
 * A guest is an ordinary account with two differences. It has a made-up
 * address no one can sign in with or send mail to, and a date it is deleted
 * on (guest_until). Saving it gives it a real address and password and clears
 * that date, and everything made in it stays.
 *
 * What a guest may not do (share goals, connect calendars, reminders, change a
 * password it never had) and how much it may hold (mordi.guest.max-items) is
 * GuestFilter's job; how
 * many may be made from one place is RateLimitFilter's.
 */
@Service
@Slf4j
public class GuestService {

    /**
     * The made-up addresses' domain. ".invalid" is reserved and can never be
     * registered, so no mail sent to one reaches anyone, and no one can sign
     * up with one: refuseGuestAddress turns them away.
     */
    public static final String GUEST_DOMAIN = "@guest.invalid";

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokens;
    private final ActivityService activity;
    private final GuestSampleWeek sampleWeek;
    private final Clock clock;
    private final Duration lifetime;
    private final int maxLive;

    @Autowired
    public GuestService(
            UserRepository users,
            PasswordEncoder encoder,
            JwtUtil jwtUtil,
            RefreshTokenService refreshTokens,
            ActivityService activity,
            GuestSampleWeek sampleWeek,
            @Value("${mordi.guest.days:7}") int days,
            @Value("${mordi.guest.max-live:500}") int maxLive) {
        this(users, encoder, jwtUtil, refreshTokens, activity, sampleWeek, Clock.systemDefaultZone(),
            Duration.ofDays(days), maxLive);
    }

    /** For tests, so time can be moved without waiting. */
    GuestService(
            UserRepository users,
            PasswordEncoder encoder,
            JwtUtil jwtUtil,
            RefreshTokenService refreshTokens,
            ActivityService activity,
            GuestSampleWeek sampleWeek,
            Clock clock,
            Duration lifetime,
            int maxLive) {
        this.users = users;
        this.encoder = encoder;
        this.jwtUtil = jwtUtil;
        this.refreshTokens = refreshTokens;
        this.activity = activity;
        this.sampleWeek = sampleWeek;
        this.clock = clock;
        this.lifetime = lifetime;
        this.maxLive = maxLive;
    }

    /** Turns away a made-up guest address wherever a real one is asked for. */
    public static void refuseGuestAddress(String normalizedEmail) {
        if (normalizedEmail != null && normalizedEmail.endsWith(GUEST_DOMAIN)) {
            throw new IllegalArgumentException("Use your own email address");
        }
    }

    /**
     * Opens a guest account, filled with a sample week unless asked not to.
     * Server timestamps carry no zone (see User.createdAt), so guest_until is
     * in the server's own time, as every other is.
     */
    @Transactional
    public AuthResponse start(GuestRequest request) {
        LocalDateTime now = LocalDateTime.now(clock);
        if (users.countByGuestUntilAfter(now) >= maxLive) {
            throw new GuestsFullException();
        }

        ZoneId zone = zone(request == null ? null : request.getTimeZone());
        User user = new User();
        user.setEmail("guest-" + UUID.randomUUID().toString().replace("-", "") + GUEST_DOMAIN);
        // A password no one is told: nobody can sign in to a guest account,
        // only keep the session it was opened with.
        user.setPassword(encoder.encode(Tokens.random()));
        user.setName("Guest");
        user.setTimeZone(zone.getId());
        // The "Try it" button says that trying is agreeing to the Terms.
        user.setTermsVersion(AuthService.TERMS_VERSION);
        user.setTermsAcceptedAt(now);
        user.setGuestUntil(now.plus(lifetime));
        users.save(user);

        if (request == null || !Boolean.FALSE.equals(request.getSample())) {
            sampleWeek.fill(user, LocalDate.now(clock.withZone(zone)));
        }
        activity.markActive(user);
        return AuthResponse.of(jwtUtil.generateToken(user.getEmail(), user.getId()), user);
    }

    /**
     * Saves a guest account: gives it the person's own address, password and
     * name, and stops it being deleted. Every session the guest had ends; the
     * caller hands back a fresh one for this device, exactly as a sign-up does.
     */
    @Transactional
    public AuthResponse claim(String guestEmail, AuthRequest request) {
        User user = users.findByEmail(guestEmail)
            .orElseThrow(() -> new InvalidCredentialsException("Not signed in"));
        if (!user.isGuest()) {
            throw new IllegalArgumentException("This account is already saved");
        }
        String email = EmailAddresses.normalize(request.getEmail());
        refuseGuestAddress(email);
        if (users.existsByEmail(email)) {
            throw new EmailAlreadyExistsException("Email already registered");
        }

        refreshTokens.revokeAllFor(user);
        user.setEmail(email);
        user.setPassword(encoder.encode(request.getPassword()));
        String name = request.getName() == null ? "" : request.getName().trim();
        user.setName(name.isEmpty() ? email.substring(0, email.indexOf('@')) : name);
        user.setTermsVersion(AuthService.TERMS_VERSION);
        user.setTermsAcceptedAt(LocalDateTime.now(clock));
        user.setGuestUntil(null);
        users.save(user);
        return AuthResponse.of(jwtUtil.generateToken(user.getEmail(), user.getId()), user);
    }

    /**
     * Deletes every guest account whose week is up, with everything in it, by
     * the same cascades as deleting an account by hand. A guest cannot be in a
     * shared goal, so nothing has to be handed over first, and there is no one
     * to send a goodbye email to.
     */
    @Scheduled(cron = "0 7 * * * *")
    @Transactional
    public int deleteExpired() {
        List<Long> expired = users.findIdsByGuestUntilBefore(LocalDateTime.now(clock));
        expired.forEach(users::deleteUserById);
        if (!expired.isEmpty()) {
            log.info("Deleted {} expired guest account(s)", expired.size());
        }
        return expired.size();
    }

    private static ZoneId zone(String id) {
        try {
            return id == null || id.isBlank() ? ZoneId.of("UTC") : ZoneId.of(id);
        } catch (RuntimeException e) {
            return ZoneId.of("UTC");
        }
    }
}
