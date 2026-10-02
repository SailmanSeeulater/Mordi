package com.mordi.backend.controller;

import com.mordi.backend.config.JwtUtil;
import com.mordi.backend.dto.AuthRequest;
import com.mordi.backend.dto.AuthResponse;
import com.mordi.backend.dto.ForgotPasswordRequest;
import com.mordi.backend.dto.ResetPasswordRequest;
import com.mordi.backend.exception.InvalidRefreshTokenException;
import com.mordi.backend.service.AuthService;
import com.mordi.backend.service.PasswordService;
import com.mordi.backend.service.RefreshTokenService;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /** The cookie that carries the refresh token. */
    static final String REFRESH_COOKIE = SessionCookies.REFRESH_COOKIE;

    private final AuthService authService;
    private final PasswordService passwordService;
    private final RefreshTokenService refreshTokenService;
    private final JwtUtil jwtUtil;
    private final SessionCookies cookies;

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
                .header(HttpHeaders.SET_COOKIE, cookies.cleared().toString())
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
            .header(HttpHeaders.SET_COOKIE, cookies.cleared().toString())
            .build();
    }

    /**
     * The same answer whether or not the address has an account, so this
     * cannot be used to find out which addresses are registered.
     */
    @PostMapping("/forgot")
    public ResponseEntity<Map<String, String>> forgot(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordService.requestReset(request.getEmail());
        return ResponseEntity.ok(Map.of("message", "If that address has an account, a reset link is on its way."));
    }

    /** No session comes back: every device was just signed out, this one included. */
    @PostMapping("/reset")
    public ResponseEntity<Void> reset(@Valid @RequestBody ResetPasswordRequest request) {
        passwordService.reset(request.getToken(), request.getPassword());
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<AuthResponse> withSession(AuthResponse body, String refreshToken) {
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookies.refresh(refreshToken).toString())
            .body(body);
    }
}
