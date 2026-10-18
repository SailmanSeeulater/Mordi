package com.mordi.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.mordi.backend.service.Icons;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;

/** One of a person's own goal categories, beside the four built in. */
@Data
@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 40)
    private String name;

    /** A key from Icons.KEYS. */
    @Column(nullable = false, length = 32)
    private String icon;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** What a goal stores as its category to point at this one: "custom:12". */
    @JsonProperty("key")
    public String getKey() {
        return id == null ? null : Icons.CUSTOM_PREFIX + id;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
