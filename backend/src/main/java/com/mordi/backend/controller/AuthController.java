package com.mordi.backend.controller;

import com.mordi.backend.config.JwtUtil;
import com.mordi.backend.dto.AuthRequest;
import com.mordi.backend.dto.AuthResponse;
import com.mordi.backend.exception.InvalidRefreshTokenException;
import com.mordi.backend.service.AuthService;
import com.mordi.backend.service.RefreshTokenService;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** The cookie that carries the refresh token. */
    static final String REFRESH_COOKIE = "mordi_refresh";

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;
    private final JwtUtil jwtUtil;
    private final boolean secureCookie;

    public AuthController(
            AuthService authService,
            RefreshTokenService refreshTokenService,
            JwtUtil jwtUtil,
            @Value("${mordi.auth.cookie-secure:true}") boolean secureCookie) {
        this.authService = authService;
        this.refreshTokenService = refreshTokenService;
        this.jwtUtil = jwtUtil;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody AuthRequest request) {
        AuthResponse body = authService.register(request);
        return withSession(body, refreshTokenService.issueFor(body.getEmail()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        AuthResponse body = authService.login(request);
        return withSession(body, refreshTokenService.issueFor(body.getEmail()));
    }

    /**
     * Trades the refresh cookie for a new access token and a new cookie.
     *
     * Called by the client when an access token has run out, which is how a
     * session outlives the access token's few minutes without the person
     * signing in again.
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        try {
            RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
            AuthResponse body = new AuthResponse(
                jwtUtil.generateToken(rotation.user().getEmail()),
                rotation.user().getEmail(),
                rotation.user().getName());
            return withSession(body, rotation.token());
        } catch (InvalidRefreshTokenException ex) {
            // Clear the cookie on the way out, so a dead token is not sent
            // again on every page load.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, clearedCookie().toString())
                .body(Map.of("status", 401, "error", ex.getMessage()));
        }
    }

    /**
     * Signs this device out on the server as well as the client. Before refresh
     * tokens existed, logging out only deleted the token from the browser; a
     * copy of it kept working until it expired.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        refreshTokenService.revoke(refreshToken);
        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, clearedCookie().toString())
            .build();
    }

    private ResponseEntity<AuthResponse> withSession(AuthResponse body, String refreshToken) {
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookie(refreshToken, refreshTokenService.ttl()).toString())
            .body(body);
    }

    /**
     * httpOnly, so no script on the page can read it: the long-lived credential
     * is exactly the one an XSS bug should not be able to take. SameSite=Strict,
     * because the only caller is this app's own code on its own origin. Scoped
     * to /api/auth, so it is not attached to every other request.
     */
    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite("Strict")
            .path("/api/auth")
            .maxAge(maxAge)
            .build();
    }

    private ResponseCookie clearedCookie() {
        return refreshCookie("", Duration.ZERO);
    }
}
