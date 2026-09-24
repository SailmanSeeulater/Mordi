package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@Entity
@Table(name = "goals")
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String title;

    @Column
    private String description;

    @Column
    private String frequency;

    @Column
    private String category;

    @Column(name = "target_per_week", nullable = false)
    private int targetPerWeek = 1;

    // The place this goal usually happens. Free text, so it can be "the gym
    // on Fifth" rather than a coordinate pair.
    @Column(name = "place_name")
    private String placeName;

    @Column
    private boolean active = true;

    // Set when the goal is archived: off the dashboard, onto History, with its
    // entries intact. Null for a current goal.
    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Not stored: how the goal looks to whoever is asking, filled in when
    // goals are listed. "owner" or "member"; everyone in it, the owner
    // included (1 for a goal nobody else has joined); messages in its thread
    // the person has not read; and, on a goal someone else owns, their name.
    @Transient
    private String role;

    @Transient
    private int memberCount = 1;

    @Transient
    private long unread;

    @Transient
    private String ownerName;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
