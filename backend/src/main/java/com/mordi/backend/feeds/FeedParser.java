package com.mordi.backend.feeds;

import biweekly.Biweekly;
import biweekly.ICalendar;
import biweekly.component.VEvent;
import biweekly.io.TimezoneAssignment;
import biweekly.io.TimezoneInfo;
import biweekly.property.DateEnd;
import biweekly.property.DateStart;
import biweekly.property.ICalProperty;
import biweekly.property.TextProperty;
import biweekly.util.DateTimeComponents;
import biweekly.util.ICalDate;
import biweekly.util.com.google.ical.compat.javautil.DateIterator;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

/**
 * Turns a Google Calendar feed into the occurrences Mordi keeps: every event
 * that touches the window from {@link #PAST_DAYS} days ago to
 * {@link #FUTURE_DAYS} days ahead, repeating ones expanded.
 *
 * Recurrence is biweekly's (RRULE, RDATE, EXDATE, and VTIMEZONE rules for the
 * zone the series repeats in). A moved or cancelled single occurrence arrives
 * as its own VEVENT with the series' UID and a RECURRENCE-ID naming the start
 * it replaces; that occurrence is dropped from the series, and the override
 * stands in for it under the same key, so a sync updates the row rather than
 * replacing it.
 *
 * Times come out as the person's own wall-clock times, which is how the
 * calendar stores every event: each instant is converted to their zone. An
 * all-day event keeps its dates as they are, and a "floating" time (no zone at
 * all) keeps its clock time, since that is what floating means.
 */
public final class FeedParser {

    public static final int PAST_DAYS = 30;
    public static final int FUTURE_DAYS = 180;
    /** Most occurrences one feed may bring: a very busy calendar's six months. */
    public static final int MAX_OCCURRENCES = 3000;

    static final int MAX_TITLE = 120;
    static final int MAX_NOTES = 1000;
    static final int MAX_PLACE = 255;
    /** The calendar's own limit on one event; anything longer is left out. */
    static final Duration MAX_LENGTH = Duration.ofDays(31);
    /** Steps through one series before giving up on it, however it is written. */
    static final int MAX_STEPS = 20_000;

    static final String UNREADABLE =
        "Google sent something Mordi couldn’t read as a calendar. Mordi will try again in 15 minutes.";

    /** One occurrence, keyed by its UID and, when it repeats, the start it was scheduled for. */
    public record FeedEvent(
        String key,
        String title,
        String notes,
        String placeName,
        LocalDateTime startsAt,
        LocalDateTime endsAt,
        boolean allDay) {
    }

    /** What a feed holds in the window; truncated when the cap cut it short. */
    public record ParsedFeed(List<FeedEvent> events, boolean truncated) {
    }

    private FeedParser() {
    }

    /**
     * @param zone  the person's zone, which timed events are converted into
     * @param today the person's today, which the window is counted from
     */
    public static ParsedFeed parse(String text, ZoneId zone, LocalDate today) throws FeedException {
        if (text == null || !text.contains("BEGIN:VCALENDAR")) {
            throw new FeedException(UNREADABLE);
        }
        List<ICalendar> calendars;
        try {
            calendars = Biweekly.parse(text).all();
        } catch (RuntimeException e) {
            throw new FeedException(UNREADABLE);
        }
        if (calendars.isEmpty()) {
            throw new FeedException(UNREADABLE);
        }
        Reader reader = new Reader(zone, today);
        for (ICalendar calendar : calendars) {
            if (!reader.read(calendar)) {
                break;
            }
        }
        return new ParsedFeed(new ArrayList<>(reader.out.values()), reader.truncated);
    }

    /** One parse's state: the window, what has been kept, and whether the cap was hit. */
    private static final class Reader {
        private final ZoneId zone;
        private final LocalDateTime from;
        private final LocalDateTime to;
        private final Map<String, FeedEvent> out = new LinkedHashMap<>();
        private boolean truncated;
        private TimezoneInfo tzinfo;

        Reader(ZoneId zone, LocalDate today) {
            this.zone = zone;
            this.from = today.minusDays(PAST_DAYS).atStartOfDay();
            this.to = today.plusDays(FUTURE_DAYS + 1L).atStartOfDay();
        }

        /** False once the cap is reached, so the caller stops. */
        boolean read(ICalendar calendar) {
            tzinfo = calendar.getTimezoneInfo();
            List<VEvent> series = new ArrayList<>();
            Map<String, List<VEvent>> overrides = new HashMap<>();
            for (VEvent event : calendar.getEvents()) {
                if (event.getDateStart() == null || event.getDateStart().getValue() == null) {
                    continue;
                }
                if (event.getRecurrenceId() != null && event.getRecurrenceId().getValue() != null) {
                    overrides.computeIfAbsent(uid(event), k -> new ArrayList<>()).add(event);
                } else {
                    series.add(event);
                }
            }

            // The starts each override replaces, as the keys their series
            // would give them. Cancelled overrides count: they remove one.
            Set<String> replaced = new HashSet<>();
            for (Map.Entry<String, List<VEvent>> entry : overrides.entrySet()) {
                for (VEvent override : entry.getValue()) {
                    replaced.add(entry.getKey() + "|" + stamp(override.getRecurrenceId().getValue()));
                }
            }

            for (VEvent event : series) {
                if (cancelled(event)) {
                    continue;
                }
                if (!expand(event, replaced)) {
                    return false;
                }
            }
            for (Map.Entry<String, List<VEvent>> entry : overrides.entrySet()) {
                for (VEvent override : entry.getValue()) {
                    if (cancelled(override)) {
                        continue;
                    }
                    String key = entry.getKey() + "|" + stamp(override.getRecurrenceId().getValue());
                    Span span = single(override);
                    if (span != null && !keep(key, override, span)) {
                        return false;
                    }
                }
            }
            return true;
        }

        private boolean expand(VEvent event, Set<String> replaced) {
            String uid = uid(event);
            boolean repeats = event.getRecurrenceRule() != null || !event.getRecurrenceDates().isEmpty();
            if (!repeats) {
                Span span = single(event);
                return span == null || keep(uid, event, span);
            }

            DateStart start = event.getDateStart();
            ICalDate first = start.getValue();
            boolean allDay = !first.hasTime();
            Length length = length(event);
            TimeZone iterateIn = iterationZone(start, first);
            DateIterator dates;
            try {
                dates = event.getDateIterator(iterateIn);
            } catch (RuntimeException e) {
                return true; // A rule biweekly cannot follow: leave the series out.
            }
            // Nothing that starts earlier than this can reach into the window.
            Instant skipTo = from.atZone(zone).toInstant().minus(length.span()).minus(Duration.ofDays(2));
            if (skipTo.isAfter(first.toInstant())) {
                dates.advanceTo(Date.from(skipTo));
            }

            int steps = 0;
            while (steps++ < MAX_STEPS) {
                Date next;
                try {
                    if (!dates.hasNext()) {
                        break;
                    }
                    next = dates.next();
                } catch (RuntimeException e) {
                    break;
                }
                Span span = allDay
                    ? daySpan(LocalDate.ofInstant(next.toInstant(), iterateIn.toZoneId()), length.days())
                    : timedSpan(next.toInstant(), floating(start), iterateIn, length.duration());
                if (!span.startsAt().isBefore(to)) {
                    break;
                }
                String key = uid + "|" + (allDay ? span.startsAt().toLocalDate().toString() : next.toInstant().toString());
                if (replaced.contains(key)) {
                    continue;
                }
                if (!keep(key, event, span)) {
                    return false;
                }
            }
            return true;
        }

        /** An event that happens once, from its own DTSTART and DTEND (or DURATION). */
        private Span single(VEvent event) {
            DateStart start = event.getDateStart();
            ICalDate first = start.getValue();
            Length length = length(event);
            if (!first.hasTime()) {
                DateTimeComponents raw = first.getRawComponents();
                LocalDate day = raw != null
                    ? LocalDate.of(raw.getYear(), raw.getMonth(), raw.getDate())
                    : LocalDate.ofInstant(first.toInstant(), TimeZone.getDefault().toZoneId());
                return daySpan(day, length.days());
            }
            return timedSpan(first.toInstant(), floating(start), iterationZone(start, first), length.duration());
        }

        /** Keeps one occurrence if it touches the window. False once the cap is reached. */
        private boolean keep(String key, VEvent event, Span span) {
            if (!span.endsAt().isAfter(from) || !span.startsAt().isBefore(to)) {
                return true;
            }
            if (Duration.between(span.startsAt(), span.endsAt()).compareTo(MAX_LENGTH) > 0) {
                return true;
            }
            if (out.containsKey(key)) {
                return true;
            }
            if (out.size() >= MAX_OCCURRENCES) {
                truncated = true;
                return false;
            }
            String title = text(event.getSummary());
            out.put(key, new FeedEvent(
                key,
                clamp(title == null ? "Busy" : title, MAX_TITLE),
                clampOrNull(text(event.getDescription()), MAX_NOTES),
                clampOrNull(text(event.getLocation()), MAX_PLACE),
                span.startsAt(),
                span.endsAt(),
                span.allDay()));
            return true;
        }

        private Span timedSpan(Instant at, boolean floating, TimeZone parsedIn, Duration length) {
            // A floating time has no zone: biweekly read its clock time in
            // the server's, so reading it back there gives the clock time,
            // which then stands as it is in the person's.
            LocalDateTime startsAt = floating
                ? LocalDateTime.ofInstant(at, parsedIn.toZoneId())
                : LocalDateTime.ofInstant(at, zone);
            LocalDateTime endsAt = floating
                ? startsAt.plus(length)
                : LocalDateTime.ofInstant(at.plus(length), zone);
            if (!endsAt.isAfter(startsAt)) {
                // No end, or none after the start: drawn as a quarter of an
                // hour, the calendar's smallest block.
                endsAt = startsAt.plusMinutes(15);
            }
            return new Span(startsAt, endsAt, false);
        }

        private static Span daySpan(LocalDate day, long days) {
            return new Span(day.atStartOfDay(), day.plusDays(Math.max(1, days)).atStartOfDay(), true);
        }

        /** How long each occurrence lasts: whole days for an all-day event. */
        private Length length(VEvent event) {
            ICalDate start = event.getDateStart().getValue();
            DateEnd end = event.getDateEnd();
            if (!start.hasTime()) {
                long days = 1;
                if (end != null && end.getValue() != null) {
                    LocalDate first = rawDate(start);
                    LocalDate last = rawDate(end.getValue());
                    days = ChronoUnit.DAYS.between(first, last);
                } else if (event.getDuration() != null && event.getDuration().getValue() != null) {
                    days = event.getDuration().getValue().toMillis() / Duration.ofDays(1).toMillis();
                }
                return new Length(Duration.ofDays(Math.max(1, days)), Math.max(1, days));
            }
            Duration length = Duration.ZERO;
            if (end != null && end.getValue() != null) {
                length = Duration.ofMillis(end.getValue().getTime() - start.getTime());
            } else if (event.getDuration() != null && event.getDuration().getValue() != null) {
                length = Duration.ofMillis(event.getDuration().getValue().toMillis());
            }
            if (length.isNegative()) {
                length = Duration.ZERO;
            }
            return new Length(length, 0);
        }

        private static LocalDate rawDate(ICalDate date) {
            DateTimeComponents raw = date.getRawComponents();
            return raw != null
                ? LocalDate.of(raw.getYear(), raw.getMonth(), raw.getDate())
                : LocalDate.ofInstant(date.toInstant(), TimeZone.getDefault().toZoneId());
        }

        private boolean floating(ICalProperty property) {
            return tzinfo.isFloating(property);
        }

        /**
         * The zone a series repeats in. "Every Monday at 9" means 9 in the
         * event's own zone, through its daylight-saving changes, so the rule
         * is followed there and only each result is converted. Dates, and
         * floating times, were read in the server's zone, so they are
         * iterated in it too.
         */
        private TimeZone iterationZone(ICalProperty property, ICalDate value) {
            TimezoneAssignment assigned = tzinfo.getTimezone(property);
            if (assigned != null && value.hasTime()) {
                return assigned.getTimeZone();
            }
            if (!value.hasTime() || tzinfo.isFloating(property)) {
                return TimeZone.getDefault();
            }
            return TimeZone.getTimeZone(ZoneOffset.UTC);
        }

        /** The original start an override replaces, written the way its series' keys are. */
        private static String stamp(ICalDate value) {
            if (!value.hasTime()) {
                return rawDate(value).toString();
            }
            return value.toInstant().toString();
        }
    }

    private record Span(LocalDateTime startsAt, LocalDateTime endsAt, boolean allDay) {
    }

    private record Length(Duration duration, long days) {
        Duration span() {
            return days > 0 ? Duration.ofDays(days) : duration;
        }
    }

    private static boolean cancelled(VEvent event) {
        return event.getStatus() != null && event.getStatus().isCancelled();
    }

    /**
     * The event's UID, which ties a series to its overrides. Shortened to a
     * hash when it is long enough to crowd the key column; made up from what
     * the event says when there is none, so it is at least stable.
     */
    static String uid(VEvent event) {
        String uid = event.getUid() == null ? null : event.getUid().getValue();
        if (uid == null || uid.isBlank()) {
            String summary = text(event.getSummary());
            String start = event.getDateStart() == null || event.getDateStart().getValue() == null
                ? "" : String.valueOf(event.getDateStart().getValue().getTime());
            return "h:" + FeedCrypto.hash("no-uid|" + summary + "|" + start);
        }
        uid = uid.strip();
        return uid.length() <= 200 ? uid : "h:" + FeedCrypto.hash(uid);
    }

    private static String text(TextProperty property) {
        if (property == null || property.getValue() == null) {
            return null;
        }
        String value = property.getValue().strip();
        return value.isEmpty() ? null : value;
    }

    private static String clamp(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String clampOrNull(String value, int max) {
        return value == null ? null : clamp(value, max);
    }
}
