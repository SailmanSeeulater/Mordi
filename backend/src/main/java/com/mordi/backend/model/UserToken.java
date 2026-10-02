package com.mordi.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;

/**
 * A one-time link: the token behind "reset your password" and, later, "verify
 * your email" and "delete my account". Single-use, short-lived, and stored
 * only as a hash.
 */
@Data
@Entity
@Table(name = "user_tokens")
public class UserToken {

    public enum Purpose { PASSWORD_RESET }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Purpose purpose;

    // A SHA-256 of the token, never the token itself.
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    public boolean isUsed() {
        return usedAt != null;
    }
}
