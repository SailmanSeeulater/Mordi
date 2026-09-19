package com.mordi.backend.push;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Looks every fifteen minutes for people whose reminder hour has come round
 * in their own time zone. A reminder can arrive up to a quarter of an hour
 * into its hour; it never arrives twice in a day.
 */
@Component
@EnableScheduling
@RequiredArgsConstructor
public class ReminderScheduler {

    private final PushService pushService;

    @Scheduled(cron = "0 */15 * * * *")
    public void tick() {
        pushService.tick(Instant.now());
    }
}
