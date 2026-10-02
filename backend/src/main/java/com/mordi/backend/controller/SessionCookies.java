package com.mordi.backend.controller;

import com.mordi.backend.service.RefreshTokenService;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The cookie that carries the refresh token, built in one place so a sign-in
 * and a password change hand out exactly the same thing.
 *
 * httpOnly, so no script on the page can read it: the long-lived credential
 * is exactly the one an XSS bug should not be able to take. SameSite=Strict,
 * because the only caller is this app's own code on its own origin. Scoped
 * to /api/auth, so it is not attached to every other request.
 */
@Component
public class SessionCookies {

    static final String REFRESH_COOKIE = "mordi_refresh";

    private final boolean secure;
    private final Duration ttl;

    public SessionCookies(
            @Value("${mordi.auth.cookie-secure:true}") boolean secure,
            RefreshTokenService refreshTokenService) {
        this.secure = secure;
        this.ttl = refreshTokenService.ttl();
    }

    public ResponseCookie refresh(String value) {
        return build(value, ttl);
    }

    public ResponseCookie cleared() {
        return build("", Duration.ZERO);
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path("/api/auth")
            .maxAge(maxAge)
            .build();
    }
}
