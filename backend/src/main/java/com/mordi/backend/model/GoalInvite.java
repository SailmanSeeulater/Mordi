package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Data;

/**
 * An invite link to a shared goal. Only the hash of its code is stored; the
 * code itself lives in the link the owner shares.
 */
@Data
@Entity
@Table(name = "goal_invites")
public class GoalInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "goal_id", nullable = false)
    private Goal goal;

    @JsonIgnore
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public boolean usableAt(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }
}
