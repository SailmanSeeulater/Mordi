package com.mordi.backend.service;

import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.mail.AccountEmails;
import com.mordi.backend.mail.ResendMailer;
import com.mordi.backend.model.User;
import com.mordi.backend.model.UserToken;
import com.mordi.backend.repository.UserRepository;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Forgotten and changed passwords. Either way the old password's sessions end
 * everywhere: whoever had it is out.
 */
@Service
public class PasswordService {

    /** How long a reset link works. Short: it is a password in all but name. */
    static final Duration RESET_TTL = Duration.ofMinutes(30);

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final UserTokenService tokens;
    private final RefreshTokenService sessions;
    private final ResendMailer mailer;
    private final String appUrl;

    public PasswordService(
            UserRepository users,
            PasswordEncoder encoder,
            UserTokenService tokens,
            RefreshTokenService sessions,
            ResendMailer mailer,
            @Value("${mordi.app.url:https://latesailor.dev}") String appUrl) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
        this.sessions = sessions;
        this.mailer = mailer;
        this.appUrl = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
    }

    /**
     * Emails a reset link if the address has an account, and says nothing
     * either way: the reply must not reveal whether an address is registered.
     * The token rides after a # so it stays out of server logs and Referers,
     * as invite codes do.
     */
    @Transactional
    public void requestReset(String email) {
        users.findByEmail(EmailAddresses.normalize(email)).ifPresent(user -> {
            String raw = tokens.issue(user, UserToken.Purpose.PASSWORD_RESET, RESET_TTL);
            String link = appUrl + "/reset-password#" + raw;
            mailer.send(AccountEmails.passwordReset(user.getEmail(), user.getName(), link, RESET_TTL));
        });
    }

    /** Sets a new password from a reset link and signs every device out. */
    @Transactional
    public void reset(String rawToken, String newPassword) {
        User user = tokens.consume(rawToken, UserToken.Purpose.PASSWORD_RESET);
        user.setPassword(encoder.encode(newPassword));
        users.save(user);
        sessions.revokeAllFor(user);
    }

    /**
     * A signed-in change. Every session ends, this device's included; the
     * caller starts a fresh one for whoever asked, so they are not thrown out
     * of the page they changed it on.
     */
    @Transactional
    public User change(String email, String currentPassword, String newPassword) {
        User user = users
            .findByEmail(email)
            .orElseThrow(() -> new InvalidCredentialsException("Not signed in"));
        if (!encoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        user.setPassword(encoder.encode(newPassword));
        users.save(user);
        sessions.revokeAllFor(user);
        return user;
    }
}
