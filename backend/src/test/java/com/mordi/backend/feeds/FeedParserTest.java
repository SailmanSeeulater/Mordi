package com.mordi.backend.feeds;

import com.mordi.backend.feeds.FeedParser.FeedEvent;
import com.mordi.backend.feeds.FeedParser.ParsedFeed;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Google-shaped feeds from src/test/resources/feeds, read as of Sunday
 * 18 October 2026: the window runs from 18 September 2026 to 17 April 2027.
 */
class FeedParserTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 18);
    private static final ZoneId LA = ZoneId.of("America/Los_Angeles");
    private static final ZoneId NY = ZoneId.of("America/New_York");
    private static final ZoneId LONDON = ZoneId.of("Europe/London");

    private static String fixture(String name) throws IOException {
        try (InputStream in = FeedParserTest.class.getResourceAsStream("/feeds/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static ParsedFeed parse(String name, ZoneId zone) throws Exception {
        return FeedParser.parse(fixture(name), zone, TODAY);
    }

    private static FeedEvent titled(List<FeedEvent> events, String title) {
        return events.stream().filter(e -> e.title().equals(title)).findFirst().orElseThrow();
    }

    @Test
    void aSingleEventIsConvertedToThePersonsZone() throws Exception {
        ParsedFeed feed = parse("single.ics", LA);

        FeedEvent dentist = titled(feed.events(), "Dentist");
        // 16:00 UTC on 20 October is 9am in Los Angeles (PDT, UTC-7).
        assertThat(dentist.startsAt()).isEqualTo(LocalDateTime.of(2026, 10, 20, 9, 0));
        assertThat(dentist.endsAt()).isEqualTo(LocalDateTime.of(2026, 10, 20, 10, 0));
        assertThat(dentist.allDay()).isFalse();
        assertThat(dentist.placeName()).isEqualTo("Main St Clinic, Suite 4");
        assertThat(dentist.notes()).isEqualTo("Bring the insurance card.");
        assertThat(dentist.key()).isEqualTo("dentist-1@google.com");
        assertThat(feed.truncated()).isFalse();
    }

    @Test
    void anEventWithNoTitleIsBusyAndOnlyTheWindowIsKept() throws Exception {
        ParsedFeed feed = parse("single.ics", LA);

        assertThat(feed.events()).extracting(FeedEvent::title).containsExactlyInAnyOrder("Dentist", "Busy");
        FeedEvent busy = titled(feed.events(), "Busy");
        assertThat(busy.notes()).isNull();
        assertThat(busy.placeName()).isNull();
    }

    @Test
    void allDayEventsKeepTheirDatesInAnyZone() throws Exception {
        for (ZoneId zone : List.of(LA, LONDON, ZoneId.of("Pacific/Auckland"))) {
            ParsedFeed feed = parse("allday.ics", zone);

            FeedEvent away = titled(feed.events(), "Weekend away");
            assertThat(away.allDay()).isTrue();
            assertThat(away.startsAt()).isEqualTo(LocalDateTime.of(2026, 10, 24, 0, 0));
            assertThat(away.endsAt()).isEqualTo(LocalDateTime.of(2026, 10, 26, 0, 0));

            // A yearly all-day event with no DTEND lasts its one day, and
            // only this year's falls inside the window.
            FeedEvent birthday = titled(feed.events(), "Sam's birthday");
            assertThat(birthday.allDay()).isTrue();
            assertThat(birthday.startsAt()).isEqualTo(LocalDateTime.of(2026, 11, 1, 0, 0));
            assertThat(birthday.endsAt()).isEqualTo(LocalDateTime.of(2026, 11, 2, 0, 0));
            assertThat(birthday.key()).isEqualTo("birthday@google.com|2026-11-01");
            assertThat(feed.events()).hasSize(2);
        }
    }

    @Test
    void aWeeklySeriesHonoursItsExdateAndItsMovedOccurrence() throws Exception {
        ParsedFeed feed = parse("weekly.ics", NY);

        assertThat(feed.events()).extracting(FeedEvent::startsAt).containsExactlyInAnyOrder(
            LocalDateTime.of(2026, 10, 5, 9, 0),
            LocalDateTime.of(2026, 10, 12, 9, 0),
            // The 19th is excluded; the 26th moved to the 27th at 2pm.
            LocalDateTime.of(2026, 10, 27, 14, 0),
            // New York leaves daylight saving on 1 November: still 9am there.
            LocalDateTime.of(2026, 11, 2, 9, 0),
            LocalDateTime.of(2026, 11, 9, 9, 0));

        FeedEvent moved = titled(feed.events(), "Standup (moved)");
        assertThat(moved.endsAt()).isEqualTo(LocalDateTime.of(2026, 10, 27, 14, 30));
        // Keyed by the start it replaces, so the row is the one the 26th had.
        assertThat(moved.key()).isEqualTo("standup@google.com|2026-10-26T13:00:00Z");
        assertThat(feed.events()).extracting(FeedEvent::key).doesNotHaveDuplicates();
    }

    @Test
    void cancelledEventsAndCancelledOccurrencesAreLeftOut() throws Exception {
        ParsedFeed feed = parse("cancelled.ics", ZoneId.of("UTC"));

        assertThat(feed.events()).extracting(FeedEvent::title)
            .containsExactlyInAnyOrder("Still on", "Daily check-in", "Daily check-in");
        assertThat(feed.events()).filteredOn(e -> e.title().equals("Daily check-in"))
            .extracting(FeedEvent::startsAt)
            .containsExactlyInAnyOrder(LocalDateTime.of(2026, 10, 19, 15, 0), LocalDateTime.of(2026, 10, 21, 15, 0));
    }

    @Test
    void aVtimezoneSeriesFollowsItsOwnZoneAndConvertsAcrossBothDstChanges() throws Exception {
        // 9am in the feed's own (VTIMEZONE-defined) Eastern time, read in
        // London. London leaves summer time on 25 October and New York on
        // 1 November, so for one week the gap is four hours, not five.
        ParsedFeed feed = parse("dst.ics", LONDON);

        assertThat(feed.events()).extracting(FeedEvent::startsAt).containsExactly(
            LocalDateTime.of(2026, 10, 19, 14, 0),
            LocalDateTime.of(2026, 10, 26, 13, 0),
            LocalDateTime.of(2026, 11, 2, 14, 0));
        assertThat(feed.events()).allSatisfy(e ->
            assertThat(e.endsAt()).isEqualTo(e.startsAt().plusHours(1)));
    }

    @Test
    void anOversizedFeedStopsAtTheCap() throws Exception {
        // Every hour for six months is over 4,000 occurrences.
        ParsedFeed feed = parse("hourly.ics", ZoneId.of("UTC"));

        assertThat(feed.truncated()).isTrue();
        assertThat(feed.events()).hasSize(FeedParser.MAX_OCCURRENCES);
        // Skipped straight to the window rather than starting on 1 October.
        assertThat(feed.events().get(0).startsAt()).isAfterOrEqualTo(LocalDateTime.of(2026, 9, 17, 0, 0));
    }

    @Test
    void longFieldsAreCutToTheirColumns() throws Exception {
        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            BEGIN:VEVENT
            UID:long@google.com
            DTSTART:20261020T160000Z
            DTEND:20261020T170000Z
            SUMMARY:%s
            DESCRIPTION:%s
            END:VEVENT
            END:VCALENDAR
            """.formatted("t".repeat(300), "n".repeat(3000));

        FeedEvent event = FeedParser.parse(ics, LA, TODAY).events().get(0);

        assertThat(event.title()).hasSize(120);
        assertThat(event.notes()).hasSize(1000);
    }

    @Test
    void somethingThatIsNotACalendarIsRefused() {
        assertThatThrownBy(() -> FeedParser.parse("<html>Sign in</html>", LA, TODAY))
            .isInstanceOf(FeedException.class)
            .hasMessage(FeedParser.UNREADABLE);
        assertThatThrownBy(() -> FeedParser.parse(null, LA, TODAY)).isInstanceOf(FeedException.class);
    }
}
