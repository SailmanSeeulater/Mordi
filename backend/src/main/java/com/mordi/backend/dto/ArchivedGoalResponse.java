package com.mordi.backend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * An archived goal as History shows it: what it was, when it ran, and what it
 * amounted to. Dates are null for a goal archived before anything was logged.
 */
public record ArchivedGoalResponse(
    Long id,
    String title,
    String category,
    int targetPerWeek,
    String placeName,
    LocalDateTime createdAt,
    LocalDateTime archivedAt,
    long entries,
    long completed,
    LocalDate firstLog,
    LocalDate lastLog) {
}
