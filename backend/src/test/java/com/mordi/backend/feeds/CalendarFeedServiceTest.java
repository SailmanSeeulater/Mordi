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
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CalendarFeedServiceTest {

    private static final String ME = "sailor@mordi.com";
    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);
    private static final String URL =
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef0123456789abcdef/basic.ics";
    // Noon UTC on Sunday 18 October 2026.
    private static final Instant NOW = Instant.parse("2026-10-18T12:00:00Z");
    private static final LocalDateTime NOW_UTC = LocalDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @Mock private CalendarFeedRepository feeds;
    @Mock private PlanEventRepository events;
    @Mock private UserRepository users;
    @Mock private FeedFetcher fetcher;

    private final FeedCrypto crypto = new FeedCrypto(KEY);
    private CalendarFeedService service;
    private User me;

    @BeforeEach
    void setUp() throws Exception {
        service = service(crypto);
        me = new User();
        me.setId(1L);
        me.setEmail(ME);
        me.setTimeZone("America/Los_Angeles");
        when(users.findByEmail(ME)).thenReturn(Optional.of(me));
        when(feeds.save(any(CalendarFeed.class))).thenAnswer(inv -> {
            CalendarFeed f = inv.getArgument(0);
            if (f.getId() == null) {
                f.setId(7L);
            }
            return f;
        });
        when(fetcher.fetch(URL)).thenReturn(fixture("single.ics"));
    }

    private CalendarFeedService service(FeedCrypto crypto) {
        return new CalendarFeedService(feeds, events, users, crypto, fetcher,
            TransactionOperations.withoutTransaction(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static String fixture(String name) throws IOException {
        try (InputStream in = CalendarFeedServiceTest.class.getResourceAsStream("/feeds/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private CalendarFeed feed(Long id) {
        CalendarFeed feed = new CalendarFeed();
        feed.setId(id);
        feed.setUser(me);
        feed.setName("Work");
        feed.setColor("violet");
        feed.setUrlCiphertext(crypto.encrypt(URL));
        feed.setUrlHash(FeedCrypto.hash(URL));
        when(feeds.findById(id)).thenReturn(Optional.of(feed));
        when(feeds.findByIdAndUser(id, me)).thenReturn(Optional.of(feed));
        return feed;
    }

    private static PlanEvent copy(Long id, String key, String title, LocalDateTime start, LocalDateTime end) {
        PlanEvent event = new PlanEvent();
        event.setId(id);
        event.setFeedId(7L);
        event.setExternalKey(key);
        event.setTitle(title);
        event.setStartsAt(start);
        event.setEndsAt(end);
        event.setColor("violet");
        return event;
    }

    private static CalendarFeedRequest connecting(String url) {
        CalendarFeedRequest request = new CalendarFeedRequest();
        request.setUrl(url);
        return request;
    }

    /* ── Off without a key ── */

    @Test
    void withoutAKeyEverythingButConfigIsNotThere() {
        CalendarFeedService off = service(new FeedCrypto(""));

        assertThat(off.config()).containsEntry("enabled", false);
        assertThatThrownBy(() -> off.list(ME)).isInstanceOf(CalendarFeedNotFoundException.class);
        assertThatThrownBy(() -> off.connect(ME, connecting(URL))).isInstanceOf(CalendarFeedNotFoundException.class);
        assertThatThrownBy(() -> off.update(ME, 7L, new CalendarFeedRequest())).isInstanceOf(CalendarFeedNotFoundException.class);
        assertThatThrownBy(() -> off.syncNow(ME, 7L, null)).isInstanceOf(CalendarFeedNotFoundException.class);
        assertThatThrownBy(() -> off.disconnect(ME, 7L)).isInstanceOf(CalendarFeedNotFoundException.class);
        assertThat(off.syncActive()).isNull();
        verifyNoInteractions(fetcher, events);
        verify(feeds, never()).save(any());
    }

    @Test
    void withAKeyConfigSaysSo() {
        assertThat(service.config()).containsEntry("enabled", true);
    }

    /* ── Connecting ── */

    @Test
    void connectingStoresTheAddressEncryptedAndSyncsAtOnce() throws Exception {
        CalendarFeedRequest request = connecting(URL.replace("https://", "webcal://"));
        request.setTimeZone("America/New_York");
        CalendarFeed saved = feed(7L);
        saved.setEventCount(2);
        saved.setLastSyncedAt(NOW_UTC);

        CalendarFeedResponse response = service.connect(ME, request);

        ArgumentCaptor<CalendarFeed> stored = ArgumentCaptor.forClass(CalendarFeed.class);
        verify(feeds).save(stored.capture());
        CalendarFeed feed = stored.getValue();
        assertThat(feed.getUser()).isSameAs(me);
        assertThat(feed.getName()).isEqualTo("Google Calendar");
        assertThat(feed.getColor()).isEqualTo("sky");
        assertThat(feed.getUrlCiphertext()).doesNotContain("google");
        assertThat(crypto.decrypt(feed.getUrlCiphertext())).isEqualTo(URL);
        assertThat(feed.getUrlHash()).isEqualTo(FeedCrypto.hash(URL));
        // The browser's zone is kept for converting times.
        assertThat(me.getTimeZone()).isEqualTo("America/New_York");

        verify(fetcher).fetch(URL);
        verify(events).saveAll(anyList());
        verify(feeds).recordSynced(7L, 2, NOW_UTC);
        assertThat(response.addressHint()).isEqualTo("calendar.google.com/…sam");
        assertThat(response.eventCount()).isEqualTo(2);
        assertThat(response.lastSyncedAt()).isEqualTo(NOW);
        assertThat(response.toString()).doesNotContain("private-");
    }

    @Test
    void anAddressThatIsNotGooglesIsRefusedBeforeAnythingHappens() throws Exception {
        assertThatThrownBy(() -> service.connect(ME, connecting("https://example.com/cal.ics")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage(FeedAddress.INVALID);
        verify(feeds, never()).save(any());
        verify(fetcher, never()).fetch(anyString());
    }

    @Test
    void theSameCalendarCannotBeConnectedTwice() {
        when(feeds.existsByUserAndUrlHash(me, FeedCrypto.hash(URL))).thenReturn(true);

        assertThatThrownBy(() -> service.connect(ME, connecting(URL)))
            .isInstanceOf(CalendarFeedTakenException.class)
            .hasMessage("That calendar is already connected.");
        verify(feeds, never()).save(any());
    }

    @Test
    void atMostFiveCalendars() {
        when(feeds.countByUser(me)).thenReturn(5L);

        assertThatThrownBy(() -> service.connect(ME, connecting(URL)))
            .isInstanceOf(CalendarFeedLimitReachedException.class);
        verify(feeds, never()).save(any());
    }

    @Test
    void aNameIsTrimmedAndCutAndAColourMustBeTheCalendars() {
        CalendarFeedRequest request = connecting(URL);
        request.setName("  " + "W".repeat(80) + "  ");
        request.setColor("rose");
        feed(7L);

        service.connect(ME, request);

        ArgumentCaptor<CalendarFeed> stored = ArgumentCaptor.forClass(CalendarFeed.class);
        verify(feeds).save(stored.capture());
        assertThat(stored.getValue().getName()).hasSize(60);
        assertThat(stored.getValue().getColor()).isEqualTo("rose");

        CalendarFeedRequest neon = connecting(URL);
        neon.setColor("neon");
        assertThatThrownBy(() -> service.connect(ME, neon)).isInstanceOf(IllegalArgumentException.class);
    }

    /* ── Syncing ── */

    @Test
    @SuppressWarnings("unchecked")
    void aSyncAddsUpdatesAndRemoves() {
        CalendarFeed feed = feed(7L);
        // Already here: the dentist under an old title, the busy block as it
        // is, and an event Google no longer has.
        PlanEvent dentist = copy(1L, "dentist-1@google.com", "Dentist (old)",
            LocalDateTime.of(2026, 10, 20, 9, 0), LocalDateTime.of(2026, 10, 20, 10, 0));
        PlanEvent busy = copy(2L, "busy-1@google.com", "Busy",
            LocalDateTime.of(2026, 10, 21, 13, 0), LocalDateTime.of(2026, 10, 21, 14, 0));
        PlanEvent gone = copy(3L, "gone@google.com", "Cancelled",
            LocalDateTime.of(2026, 10, 22, 9, 0), LocalDateTime.of(2026, 10, 22, 10, 0));
        when(events.findByFeedId(7L)).thenReturn(new ArrayList<>(List.of(dentist, busy, gone)));

        assertThat(service.sync(feed)).isTrue();

        ArgumentCaptor<List<PlanEvent>> saved = ArgumentCaptor.forClass(List.class);
        verify(events).saveAll(saved.capture());
        assertThat(saved.getValue()).containsExactly(dentist);
        assertThat(dentist.getTitle()).isEqualTo("Dentist");
        assertThat(dentist.getPlaceName()).isEqualTo("Main St Clinic, Suite 4");
        assertThat(dentist.getId()).isEqualTo(1L);
        verify(events).deleteAllByIdInBatch(List.of(3L));
        verify(feeds).recordSynced(7L, 2, NOW_UTC);
        verify(feeds, never()).recordError(anyLong(), anyString());
    }

    @Test
    @SuppressWarnings("unchecked")
    void aFirstSyncCreatesReadOnlyCopiesInTheFeedsColour() {
        CalendarFeed feed = feed(7L);
        when(events.findByFeedId(7L)).thenReturn(List.of());

        service.sync(feed);

        ArgumentCaptor<List<PlanEvent>> saved = ArgumentCaptor.forClass(List.class);
        verify(events).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(2).allSatisfy(e -> {
            assertThat(e.getFeedId()).isEqualTo(7L);
            assertThat(e.getUser()).isSameAs(me);
            assertThat(e.getColor()).isEqualTo("violet");
            assertThat(e.getExternalKey()).isNotBlank();
        });
        verify(events, never()).deleteAllByIdInBatch(any());
    }

    @Test
    void anUnchangedFeedWritesNothingButItsTime() {
        CalendarFeed feed = feed(7L);
        PlanEvent dentist = copy(1L, "dentist-1@google.com", "Dentist",
            LocalDateTime.of(2026, 10, 20, 9, 0), LocalDateTime.of(2026, 10, 20, 10, 0));
        dentist.setPlaceName("Main St Clinic, Suite 4");
        dentist.setNotes("Bring the insurance card.");
        PlanEvent busy = copy(2L, "busy-1@google.com", "Busy",
            LocalDateTime.of(2026, 10, 21, 13, 0), LocalDateTime.of(2026, 10, 21, 14, 0));
        when(events.findByFeedId(7L)).thenReturn(List.of(dentist, busy));

        service.sync(feed);

        verify(events, never()).saveAll(any());
        verify(events, never()).deleteAllByIdInBatch(any());
        verify(feeds).recordSynced(7L, 2, NOW_UTC);
    }

    @Test
    void aResetAddressKeepsTheEventsAndSaysWhy() throws Exception {
        CalendarFeed feed = feed(7L);
        when(fetcher.fetch(URL)).thenThrow(new FeedException(FeedFetcher.GONE));

        assertThat(service.sync(feed)).isFalse();

        verify(feeds).recordError(7L, FeedFetcher.GONE);
        verify(events, never()).findByFeedId(anyLong());
        verify(events, never()).saveAll(any());
        verify(events, never()).deleteAllByIdInBatch(any());
        verify(feeds, never()).recordSynced(anyLong(), anyInt(), any());
        assertThat(feed.getLastError()).isEqualTo(FeedFetcher.GONE);
    }

    @Test
    void somethingUnreadableKeepsTheEventsToo() throws Exception {
        CalendarFeed feed = feed(7L);
        when(fetcher.fetch(URL)).thenReturn("<html>Sign in to continue</html>");

        service.sync(feed);

        verify(feeds).recordError(7L, FeedParser.UNREADABLE);
        verify(events, never()).deleteAllByIdInBatch(any());
    }

    @Test
    void anAddressSealedUnderAnotherKeyAsksToReconnect() throws Exception {
        CalendarFeed feed = feed(7L);
        feed.setUrlCiphertext(new FeedCrypto(Base64.getEncoder().encodeToString(new byte[] {
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32})).encrypt(URL));

        service.sync(feed);

        verify(feeds).recordError(7L, CalendarFeedService.KEY_CHANGED);
        verify(fetcher, never()).fetch(anyString());
    }

    /* ── Sync now ── */

    @Test
    void syncNowIsOnceAMinute() {
        CalendarFeed feed = feed(7L);
        when(events.findByFeedId(7L)).thenReturn(List.of());

        service.syncNow(ME, 7L, null);

        assertThatThrownBy(() -> service.syncNow(ME, 7L, null))
            .isInstanceOf(CalendarSyncTooSoonException.class)
            .hasMessage("Synced a moment ago. Try again in a minute.");

        // A sync on record from 30 seconds ago counts too, restart or not.
        CalendarFeed other = feed(8L);
        other.setLastSyncedAt(NOW_UTC.minusSeconds(30));
        assertThatThrownBy(() -> service.syncNow(ME, 8L, null)).isInstanceOf(CalendarSyncTooSoonException.class);
        assertThat(feed.getId()).isEqualTo(7L);
    }

    @Test
    void someoneElsesCalendarIsNotThere() {
        when(feeds.findByIdAndUser(9L, me)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.syncNow(ME, 9L, null)).isInstanceOf(CalendarFeedNotFoundException.class);
        assertThatThrownBy(() -> service.update(ME, 9L, new CalendarFeedRequest())).isInstanceOf(CalendarFeedNotFoundException.class);
        assertThatThrownBy(() -> service.disconnect(ME, 9L)).isInstanceOf(CalendarFeedNotFoundException.class);
        verify(feeds, never()).delete(any());
    }

    /* ── Rename, recolour, disconnect ── */

    @Test
    void aNewColourRepaintsTheFeedsEvents() {
        CalendarFeed feed = feed(7L);
        CalendarFeedRequest request = new CalendarFeedRequest();
        request.setName("Office");
        request.setColor("amber");

        CalendarFeedResponse response = service.update(ME, 7L, request);

        assertThat(response.name()).isEqualTo("Office");
        assertThat(feed.getColor()).isEqualTo("amber");
        verify(events).updateColorByFeedId(7L, "amber");
    }

    @Test
    void disconnectingDeletesTheFeed() {
        CalendarFeed feed = feed(7L);

        service.disconnect(ME, 7L);

        verify(feeds).delete(feed);
    }

    @Test
    void listingNeverIncludesTheAddress() {
        CalendarFeed feed = feed(7L);
        when(feeds.findByUserOrderByIdAsc(me)).thenReturn(List.of(feed));

        List<CalendarFeedResponse> listed = service.list(ME);

        assertThat(listed).singleElement().satisfies(r -> {
            assertThat(r.name()).isEqualTo("Work");
            assertThat(r.addressHint()).isEqualTo("calendar.google.com/…sam");
            assertThat(r.toString()).doesNotContain("private-").doesNotContain("%40");
        });
    }

    /* ── The scheduler's run ── */

    @Test
    void theScheduledRunSyncsActiveOwnersFeedsAndCountsFailures() throws Exception {
        CalendarFeed works = feed(7L);
        CalendarFeed broken = feed(8L);
        String otherUrl = URL.replace("sam", "jo");
        broken.setUrlCiphertext(crypto.encrypt(otherUrl));
        when(fetcher.fetch(otherUrl)).thenThrow(new FeedException(FeedFetcher.UNREACHABLE));
        when(feeds.findIdsWithOwnerActiveSince(java.time.LocalDate.of(2026, 9, 18))).thenReturn(List.of(7L, 8L, 9L));
        when(feeds.findById(9L)).thenReturn(Optional.empty());
        when(events.findByFeedId(7L)).thenReturn(List.of());

        CalendarFeedService.SyncRun run = service.syncActive();

        assertThat(run).isEqualTo(new CalendarFeedService.SyncRun(3, 1, 1));
        verify(feeds).recordSynced(eq(7L), eq(2), any());
        verify(feeds).recordError(8L, FeedFetcher.UNREACHABLE);
        assertThat(works.getId()).isEqualTo(7L);
    }
}
