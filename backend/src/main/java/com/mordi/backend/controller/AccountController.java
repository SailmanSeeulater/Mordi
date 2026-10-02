package com.mordi.backend.controller;

import com.mordi.backend.config.JwtUtil;
import com.mordi.backend.dto.AuthResponse;
import com.mordi.backend.dto.ChangePasswordRequest;
import com.mordi.backend.dto.DeleteAccountRequest;
import com.mordi.backend.model.User;
import com.mordi.backend.service.AccountService;
import com.mordi.backend.service.PasswordService;
import com.mordi.backend.service.RefreshTokenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in person's own account. */
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private final PasswordService passwordService;
    private final AccountService accountService;
    private final RefreshTokenService refreshTokenService;
    private final JwtUtil jwtUtil;
    private final SessionCookies cookies;

    /**
     * Changes the password. That signs every device out, so the reply carries
     * a fresh session for this one, exactly as a sign-in does.
     */
    @PutMapping("/password")
    public ResponseEntity<AuthResponse> changePassword(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody ChangePasswordRequest request) {
        User user = passwordService.change(email, request.getCurrentPassword(), request.getNewPassword());
        AuthResponse body = new AuthResponse(
            jwtUtil.generateToken(user.getEmail(), user.getId()), user.getEmail(), user.getName());
        String refresh = refreshTokenService.issueFor(user.getEmail());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookies.refresh(refresh).toString())
            .body(body);
    }

    /**
     * Deletes the account and everything in it, now. The refresh cookie is
     * cleared on the way out; the session it named went with the account.
     */
    @DeleteMapping
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody DeleteAccountRequest request) {
        accountService.delete(email, request.getPassword());
        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, cookies.cleared().toString())
            .build();
    }
}
