package com.mordi.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Data;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Data
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // IANA zone name from the browser, e.g. "America/Los_Angeles". Used to
    // send a reminder at the person's own hour, not the server's.
    @JsonIgnore
    @Column(name = "time_zone", length = 64)
    private String timeZone;

    // Hour of the day (0-23) to send the reminder; null means reminders off.
    @JsonIgnore
    @Column(name = "reminder_hour")
    private Short reminderHour;

    // The local date a reminder last went out, so it goes at most once a day.
    @JsonIgnore
    @Column(name = "last_reminded_on")
    private LocalDate lastRemindedOn;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
