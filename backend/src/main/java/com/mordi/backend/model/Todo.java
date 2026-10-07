package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@Entity
@Table(name = "todos")
public class Todo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 200)
    private String text;

    @Column(nullable = false)
    private boolean done = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // The moment it was ticked off, rendered by the browser in the person's
    // own zone. Null while open.
    @Column(name = "completed_at")
    private Instant completedAt;

    // The person's own day it was ticked off on: where it sits in Lately and
    // which week's report counts it.
    @Column(name = "completed_on")
    private LocalDate completedOn;

    // Taken off the list by "Clear done" but kept as history.
    @JsonIgnore
    @Column(name = "cleared_at")
    private Instant clearedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
