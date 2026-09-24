package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Data;

/**
 * One person in a shared goal, the owner included. A goal that was never
 * shared has no members at all; see V14__shared_goals.sql.
 */
@Data
@Entity
@Table(name = "goal_members")
public class GoalMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "goal_id", nullable = false)
    private Goal goal;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    /** The newest message in the goal's thread this member has seen. */
    @Column(name = "last_read_message_id", nullable = false)
    private long lastReadMessageId;

    @PrePersist
    protected void onCreate() {
        joinedAt = Instant.now();
    }
}
