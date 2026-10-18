package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;

/**
 * Something planned on the calendar. Times are local wall-clock times, and
 * every event is the half-open range [startsAt, endsAt): an all-day event on
 * the 5th runs from the 5th at 00:00 to the 6th at 00:00.
 *
 * An event copied from a connected Google Calendar carries its feed's id and
 * is stored in the same wall-clock terms, converted to the person's zone.
 */
@Data
@Entity
@Table(name = "plan_events")
public class PlanEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 1000)
    private String notes;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalDateTime endsAt;

    @Column(name = "all_day", nullable = false)
    private boolean allDay;

    @Column(length = 16)
    private String color;

    @Column(name = "place_name")
    private String placeName;

    // Whether it happened: "done", "skipped", or null for not yet answered.
    @Column(length = 10)
    private String outcome;

    // The entry logged when it was marked done, so undoing removes exactly it.
    @Column(name = "behavior_id")
    private Long behaviorId;

    // The connected calendar this is a copy of, or null for an event planned
    // here. A copy is read-only: it changes in Google, and the next sync
    // brings the change.
    @Column(name = "feed_id")
    private Long feedId;

    // Which occurrence in that feed this is; see V21.
    @JsonIgnore
    @Column(name = "external_key")
    private String externalKey;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
