package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name= "behaviors")
public class Behavior {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "goal_id")
    private Goal goal;

    @Column(nullable = false)
    private String note;

    @Column
    private boolean completed;

    @Column
    private String mood;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    // Where it happened. Optional, and only ever set from a capture the
    // person asked for.
    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Column(name = "place_name")
    private String placeName;

    // How long it took, for an entry saved from the time logger. Null for an
    // ordinary entry.
    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // The moment it was logged, as an instant, so the browser can show the
    // time of day in the person's own zone. A timer session sets it to when
    // the session began.
    @Column(name = "logged_at")
    private Instant loggedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (loggedAt == null) {
            loggedAt = Instant.now();
        }
    }

}
