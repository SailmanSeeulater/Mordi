package com.mordi.backend.feeds;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedAddressTest {

    private static final String PRIVATE =
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef0123456789abcdef/basic.ics";
    private static final String PUBLIC =
        "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics";

    @Test
    void acceptsAPrivateAddressAsItIs() {
        assertThat(FeedAddress.normalise(PRIVATE)).isEqualTo(PRIVATE);
        assertThat(FeedAddress.normalise("  " + PRIVATE + "\n")).isEqualTo(PRIVATE);
        assertThat(FeedAddress.allowed(PRIVATE)).isTrue();
    }

    @Test
    void acceptsAPublicAddress() {
        assertThat(FeedAddress.normalise(PUBLIC)).isEqualTo(PUBLIC);
    }

    @Test
    void rewritesWebcalToHttpsAndFoldsOnlyTheFixedPart() {
        assertThat(FeedAddress.normalise(PRIVATE.replace("https://", "webcal://"))).isEqualTo(PRIVATE);
        assertThat(FeedAddress.normalise(PRIVATE.replace("https://calendar.google.com", "HTTPS://Calendar.Google.com")))
            .isEqualTo(PRIVATE);
        // The private key is case-sensitive, so it is left alone.
        assertThat(FeedAddress.normalise(PRIVATE.replace("abcdef0123", "ABCDEF0123")))
            .isNotEqualTo(PRIVATE);
    }

    @Test
    void writesADecodedAtTheWayGoogleDoes() {
        assertThat(FeedAddress.normalise(PRIVATE.replace("%40", "@"))).isEqualTo(PRIVATE);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        // Another host, and hosts that only start or end like Google's.
        "https://evil.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://calendar.google.com.evil.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://evilcalendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://www.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        // User info that makes the real host something else.
        "https://calendar.google.com@evil.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://evil.com@calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://evil.com/@calendar.google.com/calendar/ical/x/private-0123456789abcdef/basic.ics",
        "https://calendar.google.com%40evil.com/calendar/ical/x/private-0123456789abcdef/basic.ics",
        // Plain http, a port, IP literals.
        "http://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://calendar.google.com:8443/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://142.250.72.14/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://[2607:f8b0:4005:80b::200e]/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "https://127.0.0.1/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        // Other paths, extra pieces, and other schemes.
        "https://calendar.google.com/calendar/embed?src=sam%40gmail.com",
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics?x=1",
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics#frag",
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/full.ics",
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/basic.ics",
        "https://calendar.google.com/calendar/ical/a/b/private-0123456789abcdef/basic.ics",
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics/../../x",
        "https://calendar.google.com\\@evil.com/calendar/ical/x/private-0123456789abcdef/basic.ics",
        "file:///etc/passwd",
        "ftp://calendar.google.com/calendar/ical/x/private-0123456789abcdef/basic.ics",
        "javascript:alert(1)",
        "calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics",
        "",
    })
    void refusesEverythingElse(String url) {
        assertThatThrownBy(() -> FeedAddress.normalise(url))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage(FeedAddress.INVALID);
        assertThat(FeedAddress.allowed(url)).isFalse();
    }

    @Test
    void refusesNothingAtAll() {
        assertThatThrownBy(() -> FeedAddress.normalise(null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(FeedAddress.allowed(null)).isFalse();
    }

    @Test
    void hintsWithoutGivingTheAddressAway() {
        assertThat(FeedAddress.hint(PRIVATE)).isEqualTo("calendar.google.com/…sam");
        assertThat(FeedAddress.hint(
            "https://calendar.google.com/calendar/ical/c_9f3a1b7e%40group.calendar.google.com/private-0123456789abcdef/basic.ics"))
            .isEqualTo("calendar.google.com/…1b7e");
        assertThat(FeedAddress.hint(null)).isEqualTo("calendar.google.com/…");
        assertThat(FeedAddress.hint(PRIVATE)).doesNotContain("private");
    }
}
