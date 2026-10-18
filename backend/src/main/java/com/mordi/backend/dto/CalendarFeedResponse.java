package com.mordi.backend.dto;

import com.mordi.backend.feeds.FeedAddress;
import com.mordi.backend.model.CalendarFeed;
import java.time.Instant;
import java.time.ZoneOffset;

/**
 * A connected calendar as the browser sees it. The address itself never
 * leaves the server once saved: addressHint is enough to tell two apart.
 * lastSyncedAt is an instant (with its Z), so the browser can say "4 min ago".
 */
public record CalendarFeedResponse(
    Long id,
    String name,
    String color,
    String addressHint,
    Instant lastSyncedAt,
    String lastError,
    int eventCount) {

    public static CalendarFeedResponse of(CalendarFeed feed, String address) {
        return new CalendarFeedResponse(
            feed.getId(),
            feed.getName(),
            feed.getColor(),
            FeedAddress.hint(address),
            feed.getLastSyncedAt() == null ? null : feed.getLastSyncedAt().toInstant(ZoneOffset.UTC),
            feed.getLastError(),
            feed.getEventCount());
    }
}
