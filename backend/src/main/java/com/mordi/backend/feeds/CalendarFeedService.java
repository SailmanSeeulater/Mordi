package com.mordi.backend.feeds;

import com.mordi.backend.dto.CalendarFeedRequest;
import com.mordi.backend.dto.CalendarFeedResponse;
import com.mordi.backend.exception.CalendarFeedLimitReachedException;
import com.mordi.backend.exception.CalendarFeedNotFoundException;
import com.mordi.backend.exception.CalendarFeedTakenException;
import com.mordi.backend.exception.CalendarSyncTooSoonException;
import com.mordi.backend.model.CalendarFeed;
import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.CalendarFeedRepository;
import com.mordi.backend.repository.PlanEventRepository;
import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.PlanEventService;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;

/**
 * Google Calendars connected by their secret iCal address, and keeping
 * Mordi's copies of their events current. One way only: Mordi reads the feed
 * and never writes to Google.
 *
 * The whole feature is off unless MORDI_FEED_KEY is set (FeedCrypto): config
 * says so, every other entry point answers like a calendar that is not there,
 * and the scheduler does nothing.
 *
 * A sync fetches and reads the feed first, outside any transaction, then
 * writes the result in one: new occurrences added, changed ones updated, and
 * ones no longer in the feed (or no longer in the window) removed. When the
 * fetch or the parse fails, nothing is touched but the reason, so a feed that
 * is down for an hour does not empty the calendar.
 */
@Slf4j
@Service
public class CalendarFeedService {

    /** Most calendars one person may connect. */
    static final int MAX_FEEDS = 5;
    static final int MAX_NAME = 60;
    static final String DEFAULT_NAME = "Google Calendar";
    static final String DEFAULT_COLOR = "sky";
    /** Owners seen this recently get their feeds refreshed on the timer. */
    static final int ACTIVE_DAYS = 30;
    /** "Sync now" at most this often per feed. */
    static final Duration MIN_INTERVAL = Duration.ofMinutes(1);

    static final String KEY_CHANGED =
        "Mordi can no longer read this calendar’s address. Disconnect it and connect it again.";

    /** One scheduler run, as counts: what was due, and how it went. */
    public record SyncRun(int due, int synced, int failed) {
    }

    private final CalendarFeedRepository feeds;
    private final PlanEventRepository events;
    private final UserRepository users;
    private final FeedCrypto crypto;
    private final FeedFetcher fetcher;
    private final TransactionOperations tx;
    private final Clock clock;

    // When each feed was last fetched, for the once-a-minute limit, and which
    // ones are being fetched right now, so the timer and "Sync now" never
    // write the same feed at once. In memory: one backend, and a restart
    // forgetting either costs at most one extra fetch.
    private final Map<Long, Instant> lastAttempt = new ConcurrentHashMap<>();
    private final Set<Long> running = ConcurrentHashMap.newKeySet();

    @Autowired
    public CalendarFeedService(
            CalendarFeedRepository feeds,
            PlanEventRepository events,
            UserRepository users,
            FeedCrypto crypto,
            FeedFetcher fetcher,
            TransactionOperations tx) {
        this(feeds, events, users, crypto, fetcher, tx, Clock.systemUTC());
    }

    /** For tests, with a fixed clock. */
    CalendarFeedService(
            CalendarFeedRepository feeds,
            PlanEventRepository events,
            UserRepository users,
            FeedCrypto crypto,
            FeedFetcher fetcher,
            TransactionOperations tx,
            Clock clock) {
        this.feeds = feeds;
        this.events = events;
        this.users = users;
        this.crypto = crypto;
        this.fetcher = fetcher;
        this.tx = tx;
        this.clock = clock;
    }

    public boolean enabled() {
        return crypto.enabled();
    }

    public Map<String, Object> config() {
        return Map.of("enabled", enabled());
    }

    public List<CalendarFeedResponse> list(String email) {
        requireEnabled();
        List<CalendarFeedResponse> out = new ArrayList<>();
        for (CalendarFeed feed : feeds.findByUserOrderByIdAsc(findUser(email))) {
            out.add(respond(feed));
        }
        return out;
    }

    /**
     * Connects a calendar and reads it straight away, so the answer already
     * says how many events came in, or why none did.
     */
    public CalendarFeedResponse connect(String email, CalendarFeedRequest request) {
        requireEnabled();
        if (request == null) {
            throw new IllegalArgumentException(FeedAddress.INVALID);
        }
        String url = FeedAddress.normalise(request.getUrl());
        String hash = FeedCrypto.hash(url);
        User user = findUser(email);
        if (feeds.existsByUserAndUrlHash(user, hash)) {
            throw new CalendarFeedTakenException();
        }
        if (feeds.countByUser(user) >= MAX_FEEDS) {
            throw new CalendarFeedLimitReachedException(MAX_FEEDS);
        }
        rememberZone(user, request.getTimeZone());

        CalendarFeed feed = new CalendarFeed();
        feed.setUser(user);
        feed.setName(name(request.getName()));
        feed.setColor(color(request.getColor()));
        feed.setUrlCiphertext(crypto.encrypt(url));
        feed.setUrlHash(hash);
        feed = feeds.save(feed);

        sync(feed);
        return respond(reload(feed));
    }

    /** Rename or recolour. A new colour repaints the feed's events too. */
    @Transactional
    public CalendarFeedResponse update(String email, Long id, CalendarFeedRequest request) {
        requireEnabled();
        CalendarFeed feed = findOwned(email, id);
        if (request != null && request.getName() != null) {
            feed.setName(name(request.getName()));
        }
        if (request != null && request.getColor() != null) {
            String color = color(request.getColor());
            if (!color.equals(feed.getColor())) {
                feed.setColor(color);
                events.updateColorByFeedId(feed.getId(), color);
            }
        }
        return respond(feeds.save(feed));
    }

    /**
     * "Sync now", and the calendar page's catch-up when it opens on a feed
     * the timer has not reached. Once a minute per feed at most.
     */
    public CalendarFeedResponse syncNow(String email, Long id, CalendarFeedRequest request) {
        requireEnabled();
        CalendarFeed feed = findOwned(email, id);
        Instant now = clock.instant();
        Instant last = lastAttempt.get(feed.getId());
        boolean recent = (last != null && Duration.between(last, now).compareTo(MIN_INTERVAL) < 0)
            || (feed.getLastSyncedAt() != null
                && Duration.between(feed.getLastSyncedAt().toInstant(ZoneOffset.UTC), now).compareTo(MIN_INTERVAL) < 0);
        if (recent) {
            throw new CalendarSyncTooSoonException();
        }
        if (request != null) {
            rememberZone(feed.getUser(), request.getTimeZone());
        }
        sync(feed);
        return respond(reload(feed));
    }

    /** Disconnects; the database takes the feed's events with it (V21's cascade). */
    @Transactional
    public void disconnect(String email, Long id) {
        requireEnabled();
        CalendarFeed feed = findOwned(email, id);
        feeds.delete(feed);
        lastAttempt.remove(id);
    }

    /**
     * Fetches the feed and brings its copies up to date. True when it
     * worked; false when it failed (the reason is on the feed) or another
     * sync of the same feed was already under way.
     */
    public boolean sync(CalendarFeed feed) {
        if (!enabled() || !running.add(feed.getId())) {
            return false;
        }
        try {
            lastAttempt.put(feed.getId(), clock.instant());
            String url;
            try {
                url = crypto.decrypt(feed.getUrlCiphertext());
            } catch (GeneralSecurityException e) {
                // Sealed under another key: MORDI_FEED_KEY was changed.
                fail(feed, KEY_CHANGED);
                return false;
            }
            FeedParser.ParsedFeed parsed;
            try {
                ZoneId zone = zoneOf(feed.getUser());
                parsed = FeedParser.parse(fetcher.fetch(url), zone, LocalDate.now(clock.withZone(zone)));
            } catch (FeedException e) {
                fail(feed, e.getMessage());
                return false;
            }
            tx.executeWithoutResult(status -> store(feed, parsed));
            return true;
        } finally {
            running.remove(feed.getId());
        }
    }

    /**
     * The scheduler's run: every feed whose owner has been seen in the last
     * month, one at a time. Everyone else's catch up when they next open the
     * calendar. Null when the feature is off.
     */
    public SyncRun syncActive() {
        if (!enabled()) {
            return null;
        }
        LocalDate since = LocalDate.now(clock.withZone(ZoneOffset.UTC)).minusDays(ACTIVE_DAYS);
        List<Long> due = feeds.findIdsWithOwnerActiveSince(since);
        int synced = 0;
        int failed = 0;
        for (Long id : due) {
            CalendarFeed feed = feeds.findById(id).orElse(null);
            if (feed == null) {
                continue; // Disconnected since the list was read.
            }
            try {
                if (sync(feed)) {
                    synced++;
                } else {
                    failed++;
                }
            } catch (RuntimeException e) {
                // The class only: a database message can quote the values it refused.
                failed++;
                log.warn("Calendar feed {} could not be stored: {}", id, e.getClass().getSimpleName());
            }
        }
        return new SyncRun(due.size(), synced, failed);
    }

    /** The write half of a sync, inside its transaction. */
    void store(CalendarFeed feed, FeedParser.ParsedFeed parsed) {
        Map<String, PlanEvent> existing = new HashMap<>();
        List<Long> gone = new ArrayList<>();
        for (PlanEvent event : events.findByFeedId(feed.getId())) {
            if (existing.putIfAbsent(event.getExternalKey(), event) != null) {
                gone.add(event.getId());
            }
        }
        List<PlanEvent> changed = new ArrayList<>();
        for (FeedParser.FeedEvent occurrence : parsed.events()) {
            PlanEvent event = existing.remove(occurrence.key());
            if (event == null) {
                event = new PlanEvent();
                event.setUser(feed.getUser());
                event.setFeedId(feed.getId());
                event.setExternalKey(occurrence.key());
                copy(occurrence, event, feed.getColor());
                changed.add(event);
            } else if (copy(occurrence, event, feed.getColor())) {
                changed.add(event);
            }
        }
        for (PlanEvent left : existing.values()) {
            gone.add(left.getId());
        }
        if (!changed.isEmpty()) {
            events.saveAll(changed);
        }
        if (!gone.isEmpty()) {
            events.deleteAllByIdInBatch(gone);
        }
        LocalDateTime now = LocalDateTime.now(clock.withZone(ZoneOffset.UTC));
        feeds.recordSynced(feed.getId(), parsed.events().size(), now);
        feed.setEventCount(parsed.events().size());
        feed.setLastSyncedAt(now);
        feed.setLastError(null);
    }

    /** Copies one occurrence onto its row; true when anything changed. */
    private static boolean copy(FeedParser.FeedEvent from, PlanEvent to, String color) {
        boolean changed = !Objects.equals(to.getTitle(), from.title())
            || !Objects.equals(to.getNotes(), from.notes())
            || !Objects.equals(to.getPlaceName(), from.placeName())
            || !Objects.equals(to.getStartsAt(), from.startsAt())
            || !Objects.equals(to.getEndsAt(), from.endsAt())
            || to.isAllDay() != from.allDay()
            || !Objects.equals(to.getColor(), color);
        if (changed) {
            to.setTitle(from.title());
            to.setNotes(from.notes());
            to.setPlaceName(from.placeName());
            to.setStartsAt(from.startsAt());
            to.setEndsAt(from.endsAt());
            to.setAllDay(from.allDay());
            to.setColor(color);
        }
        return changed;
    }

    private void fail(CalendarFeed feed, String reason) {
        String message = reason == null || reason.isBlank() ? FeedFetcher.UNREACHABLE : reason;
        if (message.length() > 200) {
            message = message.substring(0, 200);
        }
        feeds.recordError(feed.getId(), message);
        feed.setLastError(message);
    }

    private CalendarFeedResponse respond(CalendarFeed feed) {
        String url;
        try {
            url = crypto.decrypt(feed.getUrlCiphertext());
        } catch (GeneralSecurityException e) {
            url = null;
        }
        return CalendarFeedResponse.of(feed, url);
    }

    private CalendarFeed reload(CalendarFeed feed) {
        return feeds.findById(feed.getId()).orElse(feed);
    }

    /**
     * The browser's zone, kept on the account the same way reminders keep
     * it, so a 9am meeting in New York reads 6am for someone in Los Angeles.
     * A zone that is not real is ignored rather than refused: it should not
     * stop a calendar connecting.
     */
    private void rememberZone(User user, String zone) {
        if (zone == null || zone.isBlank()) {
            return;
        }
        try {
            String id = ZoneId.of(zone.trim()).getId();
            if (!id.equals(user.getTimeZone())) {
                user.setTimeZone(id);
                users.save(user);
            }
        } catch (DateTimeException e) {
            // Leave the zone as it was.
        }
    }

    static ZoneId zoneOf(User user) {
        try {
            return user.getTimeZone() == null ? ZoneOffset.UTC : ZoneId.of(user.getTimeZone());
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }

    private static String name(String name) {
        String trimmed = name == null ? "" : name.strip();
        if (trimmed.isEmpty()) {
            return DEFAULT_NAME;
        }
        return trimmed.length() <= MAX_NAME ? trimmed : trimmed.substring(0, MAX_NAME);
    }

    private static String color(String color) {
        if (color == null || color.isBlank()) {
            return DEFAULT_COLOR;
        }
        if (!PlanEventService.COLORS.contains(color)) {
            throw new IllegalArgumentException("Unknown colour: " + color);
        }
        return color;
    }

    private void requireEnabled() {
        if (!enabled()) {
            throw new CalendarFeedNotFoundException();
        }
    }

    /** Someone else's calendar is reported exactly like one that does not exist. */
    private CalendarFeed findOwned(String email, Long id) {
        return feeds.findByIdAndUser(id, findUser(email)).orElseThrow(CalendarFeedNotFoundException::new);
    }

    private User findUser(String email) {
        return users.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
