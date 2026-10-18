package com.mordi.backend.feeds;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class FeedFetcherTest {

    private static final String URL =
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics";

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static HttpClient answering(int status, String body) throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<InputStream> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn((HttpResponse) response);
        return http;
    }

    @Test
    void theRealClientNeverFollowsARedirectAndGivesUpConnectingInTenSeconds() {
        HttpClient http = new FeedFetcher().http;

        assertThat(http.followRedirects()).isEqualTo(HttpClient.Redirect.NEVER);
        assertThat(http.connectTimeout()).contains(Duration.ofSeconds(10));
    }

    @Test
    @SuppressWarnings("unchecked")
    void asksForTheFeedAsMordiWithATimeout() throws Exception {
        HttpClient http = answering(200, "BEGIN:VCALENDAR");

        assertThat(new FeedFetcher(http).fetch(URL)).isEqualTo("BEGIN:VCALENDAR");

        ArgumentCaptor<HttpRequest> sent = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(sent.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(sent.getValue().uri().toString()).isEqualTo(URL);
        assertThat(sent.getValue().headers().firstValue("User-Agent")).contains("Mordi");
        assertThat(sent.getValue().timeout()).contains(Duration.ofSeconds(20));
    }

    @Test
    void neverFetchesAnAddressOutsideTheAllowList() {
        HttpClient http = mock(HttpClient.class);

        assertThatThrownBy(() -> new FeedFetcher(http).fetch("https://169.254.169.254/latest/meta-data"))
            .isInstanceOf(FeedException.class);
        verifyNoInteractions(http);
    }

    @Test
    void aResetOrDeletedAddressSaysSo() throws Exception {
        for (int status : new int[] {401, 404}) {
            FeedFetcher fetcher = new FeedFetcher(answering(status, ""));
            assertThatThrownBy(() -> fetcher.fetch(URL))
                .isInstanceOf(FeedException.class)
                .hasMessage(FeedFetcher.GONE);
        }
    }

    @Test
    void aRedirectOrServerErrorIsAFailureNotAFollow() throws Exception {
        FeedFetcher redirected = new FeedFetcher(answering(302, ""));
        assertThatThrownBy(() -> redirected.fetch(URL))
            .isInstanceOf(FeedException.class)
            .hasMessageContaining("(302)")
            .hasMessageNotContaining("calendar.google.com");
        FeedFetcher failing = new FeedFetcher(answering(503, ""));
        assertThatThrownBy(() -> failing.fetch(URL)).hasMessageContaining("(503)");
    }

    @Test
    @SuppressWarnings("unchecked")
    void anUnreachableGoogleIsSaidPlainlyWithoutTheAddress() throws Exception {
        HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new ConnectException("Connection refused: " + URL));

        assertThatThrownBy(() -> new FeedFetcher(http).fetch(URL))
            .isInstanceOf(FeedException.class)
            .hasMessage(FeedFetcher.UNREACHABLE);
    }

    @Test
    void stopsReadingJustPastTheCap() {
        // An endless body: reading has to stop at the cap, not run on.
        AtomicLong served = new AtomicLong();
        InputStream endless = new InputStream() {
            @Override
            public int read() {
                served.incrementAndGet();
                return 'x';
            }

            @Override
            public int read(byte[] b, int off, int len) {
                served.addAndGet(len);
                Arrays.fill(b, off, off + len, (byte) 'x');
                return len;
            }
        };

        assertThatThrownBy(() -> FeedFetcher.readCapped(endless, FeedFetcher.MAX_BYTES))
            .isInstanceOf(FeedException.class)
            .hasMessage(FeedFetcher.TOO_BIG);
        assertThat(served.get()).isLessThanOrEqualTo(FeedFetcher.MAX_BYTES + 32 * 1024);
    }

    @Test
    void readsABodyUnderTheCapAsUtf8() throws IOException, FeedException {
        assertThat(FeedFetcher.readCapped(new ByteArrayInputStream("Café".getBytes(StandardCharsets.UTF_8)), 10))
            .isEqualTo("Café");
    }
}
