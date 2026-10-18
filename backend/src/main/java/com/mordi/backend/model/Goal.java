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

    // A built-in key ("fitness"), "custom:<id>" for one of the person's own
    // categories, or null.
    @Column
    private String category;

    // A key from Icons.KEYS, chosen for this goal. Null means it shows its
    // category's icon, or the thumbtack when it has no category.
    @Column(length = 32)
    private String icon;

    @Column(name = "target_per_week", nullable = false)
    private int targetPerWeek = 1;

    // The weekdays this goal is planned for, repeating every week: a 7-bit
    // mask, bit 0 Monday through bit 6 Sunday (ISO order, whatever day the
    // person's calendar starts on). Null for none, when any day counts. When
    // set, targetPerWeek is the number of days in it (see PlannedDays).
    @Column(name = "planned_days")
    private Short plannedDays;

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

    // Not stored: for a goal in a custom category, that category's name and
    // icon, so anyone in a shared goal can draw it without being able to list
    // the owner's categories. Null otherwise.
    @Transient
    private String categoryName;

    @Transient
    private String categoryIcon;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
