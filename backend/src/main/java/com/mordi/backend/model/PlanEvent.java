package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;

/**
 * Something planned on the calendar. Times are local wall-clock times, and
 * every event is the half-open range [startsAt, endsAt): an all-day event on
 * the 5th runs from the 5th at 00:00 to the 6th at 00:00.
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
