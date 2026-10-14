package com.mordi.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Writes the day's totals just before the UTC day ends. Someone whose only
 * visit falls in the last five minutes is missing from that day's active
 * count, though later weekly and monthly ones include them: close enough for
 * a count. EnableScheduling is on ReminderScheduler.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StatsScheduler {

    private final StatsService statsService;

    @Scheduled(cron = "0 55 23 * * *", zone = "UTC")
    public void snapshot() {
        try {
            statsService.snapshotToday();
        } catch (RuntimeException e) {
            log.warn("Could not write the daily usage snapshot: {}", e.getMessage());
        }
    }
}
