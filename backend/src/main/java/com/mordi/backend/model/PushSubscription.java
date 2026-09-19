package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Data;

/** One browser's Web Push subscription: where to send, and its keys. */
@Data
@Entity
@Table(name = "push_subscriptions")
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 1000)
    private String endpoint;

    /** The browser's P-256 public key, base64url, 65 bytes uncompressed. */
    @Column(nullable = false, length = 200)
    private String p256dh;

    /** The browser's 16-byte auth secret, base64url. */
    @Column(nullable = false, length = 100)
    private String auth;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}
