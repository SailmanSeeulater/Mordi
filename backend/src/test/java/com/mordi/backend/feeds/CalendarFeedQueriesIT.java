package com.mordi.backend.feeds;

import com.mordi.backend.dto.CalendarFeedRequest;
import com.mordi.backend.dto.CalendarFeedResponse;
import com.mordi.backend.model.CalendarFeed;
import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.CalendarFeedRepository;
import com.mordi.backend.repository.PlanEventRepository;
import com.mordi.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Connected calendars against a real PostgreSQL migrated by Flyway: V21's
 * tables, its unique and check constraints and both cascades, every query the
 * feature adds, and a whole sync written through them. The unit tests mock
 * all of these. Google is not called: the fetcher hands back a fixture. Each
 * test's rows are rolled back.
 *
 *   MORDI_IT_DB=1 SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mordi \
 *   SPRING_DATASOURCE_PASSWORD=... ./mvnw test -Dtest=CalendarFeedQueriesIT
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "MORDI_IT_DB", matches = "1")
class CalendarFeedQueriesIT {

    private static final String URL =
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef0123456789abcdef/basic.ics";
    private static final Instant NOW = Instant.parse("2026-10-18T12:00:00Z");

    @Autowired private UserRepository users;
    @Autowired private CalendarFeedRepository feeds;
    @Autowired private PlanEventRepository events;
    @Autowired private EntityManager em;

    private final FeedCrypto crypto = new FeedCrypto(Base64.getEncoder().encodeToString(new byte[32]));
    private String body;
    private CalendarFeedService service;
    private User sam;
    private User alex;

    @BeforeEach
    void setUp() throws IOException {
        body = fixture("single.ics");
        FeedFetcher fetcher = new FeedFetcher(null) {
            @Override
            public String fetch(String url) {
                return body;
            }
        };
        service = new CalendarFeedService(feeds, events, users, crypto, fetcher,
            TransactionOperations.withoutTransaction(), Clock.fixed(NOW, ZoneOffset.UTC));
        sam = person("Sam", LocalDate.of(2026, 10, 17));
        alex = person("Alex", LocalDate.of(2026, 8, 1));
    }

    private static String fixture(String name) throws IOException {
        try (InputStream in = CalendarFeedQueriesIT.class.getResourceAsStream("/feeds/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private User person(String name, LocalDate lastActive) {
        User user = new User();
        user.setName(name);
        user.setEmail(name.toLowerCase() + "-" + UUID.randomUUID() + "@it.mordi");
        user.setPassword("x");
        user.setTimeZone("America/Los_Angeles");
        user.setLastActiveOn(lastActive);
        return users.save(user);
    }

    private CalendarFeed feed(User owner, String url) {
        CalendarFeed feed = new CalendarFeed();
        feed.setUser(owner);
        feed.setName("Work");
        feed.setColor("violet");
        feed.setUrlCiphertext(crypto.encrypt(url));
        feed.setUrlHash(FeedCrypto.hash(url));
        return feeds.save(feed);
    }

    private PlanEvent copy(CalendarFeed feed, String key) {
        PlanEvent event = new PlanEvent();
        event.setUser(feed.getUser());
        event.setFeedId(feed.getId());
        event.setExternalKey(key);
        event.setTitle("Standup");
        event.setStartsAt(LocalDateTime.of(2026, 10, 19, 9, 0));
        event.setEndsAt(LocalDateTime.of(2026, 10, 19, 9, 30));
        return events.save(event);
    }

    private long count(String sql, Object id) {
        return ((Number) em.createNativeQuery(sql).setParameter(1, id).getSingleResult()).longValue();
    }

    @Test
    void aWholeSyncLandsAndASecondOneUpdatesInPlace() throws IOException {
        CalendarFeedRequest request = new CalendarFeedRequest();
        request.setUrl(URL);
        request.setName("Work");

        CalendarFeedResponse connected = service.connect(sam.getEmail(), request);
        em.flush();
        em.clear();

        assertThat(connected.eventCount()).isEqualTo(2);
        assertThat(connected.lastError()).isNull();
        assertThat(connected.lastSyncedAt()).isEqualTo(NOW);
        CalendarFeed stored = feeds.findById(connected.id()).orElseThrow();
        assertThat(stored.getUrlCiphertext()).doesNotContain("google");
        assertThat(stored.getUrlHash()).hasSize(64);
        Long dentistId = events.findByFeedId(connected.id()).stream()
            .filter(e -> e.getTitle().equals("Dentist")).findFirst().orElseThrow().getId();

        // Google renames the dentist and drops the busy block.
        body = fixture("single.ics").replace("SUMMARY:Dentist", "SUMMARY:Dentist, rebooked")
            .replaceAll("(?s)BEGIN:VEVENT\\s+DTSTART:20261021.*?END:VEVENT\\s+", "");
        service.sync(feeds.findById(connected.id()).orElseThrow());
        em.flush();
        em.clear();

        assertThat(events.findByFeedId(connected.id())).singleElement().satisfies(e -> {
            assertThat(e.getId()).isEqualTo(dentistId);
            assertThat(e.getTitle()).isEqualTo("Dentist, rebooked");
            assertThat(e.getStartsAt()).isEqualTo(LocalDateTime.of(2026, 10, 20, 9, 0));
        });
        assertThat(feeds.findById(connected.id()).orElseThrow().getEventCount()).isEqualTo(1);
    }

    @Test
    void theDerivedQueriesFindCountAndScopeByOwner() {
        CalendarFeed work = feed(sam, URL);
        CalendarFeed home = feed(sam, URL.replace("sam", "home"));
        CalendarFeed theirs = feed(alex, URL);
        em.flush();

        assertThat(feeds.findByUserOrderByIdAsc(sam)).extracting(CalendarFeed::getId)
            .containsExactly(work.getId(), home.getId());
        assertThat(feeds.countByUser(sam)).isEqualTo(2);
        assertThat(feeds.existsByUserAndUrlHash(sam, FeedCrypto.hash(URL))).isTrue();
        assertThat(feeds.existsByUserAndUrlHash(sam, FeedCrypto.hash(URL + "x"))).isFalse();
        assertThat(feeds.findByIdAndUser(theirs.getId(), sam)).isEmpty();
        assertThat(feeds.findByIdAndUser(work.getId(), sam)).isPresent();
    }

    @Test
    void onlyFeedsOfRecentlyActiveOwnersAreDue() {
        CalendarFeed samsFeed = feed(sam, URL);
        feed(alex, URL);
        em.flush();

        assertThat(feeds.findIdsWithOwnerActiveSince(LocalDate.of(2026, 9, 18)))
            .contains(samsFeed.getId())
            .allSatisfy(id -> assertThat(feeds.findById(id).orElseThrow().getUser().getLastActiveOn())
                .isAfterOrEqualTo(LocalDate.of(2026, 9, 18)));
    }

    @Test
    void recordingASyncOrAnErrorTouchesOnlyThoseColumns() {
        CalendarFeed feed = feed(sam, URL);
        em.flush();
        LocalDateTime at = LocalDateTime.of(2026, 10, 18, 12, 0);

        feeds.recordError(feed.getId(), "Google no longer recognises this address. Copy the secret address again.");
        assertThat(feeds.findById(feed.getId()).orElseThrow().getLastError()).startsWith("Google no longer");

        feeds.recordSynced(feed.getId(), 42, at);
        CalendarFeed after = feeds.findById(feed.getId()).orElseThrow();
        assertThat(after.getEventCount()).isEqualTo(42);
        assertThat(after.getLastSyncedAt()).isEqualTo(at);
        assertThat(after.getLastError()).isNull();
        assertThat(after.getName()).isEqualTo("Work");
    }

    @Test
    void recolouringReachesOnlyThatFeedsEvents() {
        CalendarFeed feed = feed(sam, URL);
        PlanEvent copied = copy(feed, "a@google.com|2026-10-19T13:00:00Z");
        PlanEvent own = new PlanEvent();
        own.setUser(sam);
        own.setTitle("Gym");
        own.setColor("sage");
        own.setStartsAt(LocalDateTime.of(2026, 10, 19, 7, 0));
        own.setEndsAt(LocalDateTime.of(2026, 10, 19, 8, 0));
        events.save(own);
        em.flush();

        events.updateColorByFeedId(feed.getId(), "amber");

        assertThat(events.findById(copied.getId()).orElseThrow().getColor()).isEqualTo("amber");
        assertThat(events.findById(own.getId()).orElseThrow().getColor()).isEqualTo("sage");
        assertThat(events.findByFeedId(feed.getId())).extracting(PlanEvent::getId).containsExactly(copied.getId());
    }

    @Test
    void theSameCalendarCannotBeConnectedTwiceByOnePerson() {
        feed(sam, URL);
        em.flush();

        assertThatThrownBy(() -> {
            feed(sam, URL);
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void oneOccurrenceIsOneRowPerFeed() {
        CalendarFeed feed = feed(sam, URL);
        copy(feed, "standup@google.com|2026-10-19T13:00:00Z");
        em.flush();

        assertThatThrownBy(() -> {
            copy(feed, "standup@google.com|2026-10-19T13:00:00Z");
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aCopyNeedsItsKey() {
        CalendarFeed feed = feed(sam, URL);
        em.flush();

        assertThatThrownBy(() -> {
            copy(feed, null);
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void disconnectingTakesTheCopiesAndLeavesEverythingElse() {
        CalendarFeed feed = feed(sam, URL);
        PlanEvent copied = copy(feed, "a@google.com");
        PlanEvent own = new PlanEvent();
        own.setUser(sam);
        own.setTitle("Gym");
        own.setStartsAt(LocalDateTime.of(2026, 10, 19, 7, 0));
        own.setEndsAt(LocalDateTime.of(2026, 10, 19, 8, 0));
        events.save(own);
        em.flush();
        em.clear();

        service.disconnect(sam.getEmail(), feed.getId());
        em.flush();
        em.clear();

        assertThat(feeds.findById(feed.getId())).isEmpty();
        assertThat(events.findById(copied.getId())).isEmpty();
        assertThat(events.findById(own.getId())).isPresent();
    }

    @Test
    void deletingTheAccountTakesItsFeedsAndTheirCopies() {
        CalendarFeed feed = feed(sam, URL);
        copy(feed, "a@google.com");
        em.flush();

        users.deleteUserById(sam.getId());
        em.flush();
        em.clear();

        assertThat(count("select count(*) from calendar_feeds where user_id = ?1", sam.getId())).isZero();
        assertThat(count("select count(*) from plan_events where feed_id = ?1", feed.getId())).isZero();
    }
}
