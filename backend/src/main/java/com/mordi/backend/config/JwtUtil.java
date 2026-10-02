package com.mordi.backend.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtUtil {

    /** The account's id, alongside the email in the subject. */
    static final String USER_ID = "uid";

    /** What a valid token says about who sent it. */
    public record Claims(String email, Long userId) {}

    @Value("${mordi.jwt.secret}")
    private String secret;

    @Value("${mordi.jwt.expiration}")
    private long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * The id rides along with the email so a token can be tied to one account
     * and not merely one address: after an account is deleted and the address
     * signed up again, the old token names an id that no longer exists.
     */
    public String generateToken(String email, Long userId) {
        return Jwts.builder()
            .subject(email)
            .claim(USER_ID, userId)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSigningKey())
            .compact();
    }

    /** The token's claims, or null if it is forged, expired or malformed. */
    public Claims parse(String token) {
        try {
            io.jsonwebtoken.Claims payload = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
            Number id = payload.get(USER_ID, Number.class);
            return new Claims(payload.getSubject(), id == null ? null : id.longValue());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
