package com.mordi.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Data;

/**
 * One UTC day's totals. Counts only: nothing here refers to a person, so the
 * table can be kept and shown without saying who any of them were.
 */
@Data
@Entity
@Table(name = "daily_stats")
public class DailyStats {

    @Id
    @Column(name = "day")
    private LocalDate day;

    @Column(name = "total_users", nullable = false)
    private int totalUsers;

    @Column(name = "new_users", nullable = false)
    private int newUsers;

    // Last seen today, within the last 7 days, within the last 30 days.
    @Column(name = "active_users", nullable = false)
    private int activeUsers;

    @Column(name = "weekly_active_users", nullable = false)
    private int weeklyActiveUsers;

    @Column(name = "monthly_active_users", nullable = false)
    private int monthlyActiveUsers;

    @Column(name = "entries_logged", nullable = false)
    private int entriesLogged;

    @Column(name = "todos_done", nullable = false)
    private int todosDone;

    @Column(name = "goals_created", nullable = false)
    private int goalsCreated;

    // People who signed up four to eight weeks ago, and how many of them were
    // seen in the last week: whether anyone comes back.
    @Column(name = "cohort_size", nullable = false)
    private int cohortSize;

    @Column(name = "cohort_retained", nullable = false)
    private int cohortRetained;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
