package com.mordi.backend.feeds;

import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Refreshes connected Google Calendars every fifteen minutes, counted from
 * the end of the last run, so runs never overlap however long one takes.
 * Feeds are fetched one after another, never in parallel: the VM is short on
 * memory, and a feed can be 5 MB. The first run waits two minutes, past the
 * backend's slow start. EnableScheduling is on ReminderScheduler.
 *
 * One log line per run, counts only: never an address.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CalendarFeedScheduler {

    private final CalendarFeedService service;

    @Scheduled(fixedDelay = 15, initialDelay = 2, timeUnit = TimeUnit.MINUTES)
    public void refresh() {
        long started = System.nanoTime();
        try {
            CalendarFeedService.SyncRun run = service.syncActive();
            if (run != null) {
                log.info("Calendar feeds: {} due, {} synced, {} failed, in {} ms",
                    run.due(), run.synced(), run.failed(), (System.nanoTime() - started) / 1_000_000);
            }
        } catch (RuntimeException e) {
            log.warn("Calendar feed run stopped: {}", e.getClass().getSimpleName());
        }
    }
}
