package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A Google Calendar connected by its secret iCal address. Read one way only:
 * its events are copied into plan_events with this feed's id, and every sync
 * brings the copies up to date.
 *
 * Never serialised as it is: the address is a credential, so the API answers
 * with {@link com.mordi.backend.dto.CalendarFeedResponse}, which carries a
 * hint of it and nothing more.
 */
@Data
@Entity
@Table(name = "calendar_feeds")
public class CalendarFeed {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 60)
    private String name;

    // A name from the calendar's palette, like an event's.
    @Column(length = 16)
    private String color;

    // AES-256-GCM, nonce first, base64. See FeedCrypto.
    @JsonIgnore
    @Column(name = "url_ciphertext", nullable = false, columnDefinition = "TEXT")
    private String urlCiphertext;

    // SHA-256 hex of the normalised address, for spotting the same calendar twice.
    @JsonIgnore
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "url_hash", nullable = false, length = 64)
    private String urlHash;

    // UTC, so the browser can tell how long ago it was.
    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    // What went wrong last time, in words for the person; null once it works.
    @Column(name = "last_error", length = 200)
    private String lastError;

    @Column(name = "event_count", nullable = false)
    private int eventCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
