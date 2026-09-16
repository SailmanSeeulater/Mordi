package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "reports")
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "week_end", nullable = false)
    private LocalDate weekEnd;

    @Column(name = "total_behaviors")
    private Integer totalBehaviors;

    @Column(name = "completed_behaviors")
    private Integer completedBehaviors;

    @Column(name = "completion_rate")
    private Double completionRate;

    @Column(name ="most_common_mood")
    private String mostCommonMood;

    // What the week was supposed to contain, and what it actually did: the
    // sum of every active goal's weekly target, and how much of that was met.
    // completionRate is achieved/planned as a percentage.
    @Column(name = "planned_entries")
    private Integer plannedEntries;

    @Column(name = "achieved_entries")
    private Integer achievedEntries;

    @Column(name = "goals_on_track")
    private Integer goalsOnTrack;

    @Column(name = "goals_total")
    private Integer goalsTotal;

    @Column(length = 1000)
    private String summary;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
