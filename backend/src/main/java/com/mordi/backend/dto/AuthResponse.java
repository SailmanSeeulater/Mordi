package com.mordi.backend.dto;

import com.mordi.backend.model.User;
import java.time.LocalDateTime;
import lombok.Data;

@Data
public class AuthResponse {

    private String token;
    private String email;
    private String name;

    /**
     * When a "Try it" account will be deleted, for the banner that says so;
     * null for an ordinary account. A server time, without a zone like every
     * other, so the browser shows only its date.
     */
    private LocalDateTime guestUntil;

    public AuthResponse(String token, String email, String name) {
        this.token = token;
        this.email = email;
        this.name = name;
    }

    /** The answer to anything that hands out a session for this account. */
    public static AuthResponse of(String token, User user) {
        AuthResponse body = new AuthResponse(token, user.getEmail(), user.getName());
        body.setGuestUntil(user.getGuestUntil());
        return body;
    }
}
