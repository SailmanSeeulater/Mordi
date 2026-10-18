package com.mordi.backend.feeds;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Downloads one calendar feed from Google.
 *
 * Only addresses {@link FeedAddress#allowed} accepts are fetched, redirects
 * are never followed (a redirect could lead anywhere, which is the whole risk
 * the allow-list exists for), and the body is read up to {@link #MAX_BYTES}
 * and no further, so a huge or endless response costs the server 5 MB at most.
 *
 * Failures come back as {@link FeedException} with a sentence for the person.
 * None of them, and nothing logged here, contains the address.
 */
@Component
public class FeedFetcher {

    static final int MAX_BYTES = 5 * 1024 * 1024;

    static final String GONE =
        "Google no longer recognises this address. Copy the secret address again.";
    static final String UNREACHABLE =
        "Couldn’t reach Google Calendar. Mordi will try again in 15 minutes.";
    static final String TOO_BIG =
        "This calendar is over 5 MB, more than Mordi can read.";

    final HttpClient http;

    @Autowired
    public FeedFetcher() {
        this(HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10))
            .build());
    }

    /** For tests, so the request can be answered without reaching Google. */
    FeedFetcher(HttpClient http) {
        this.http = http;
    }

    public String fetch(String url) throws FeedException {
        if (!FeedAddress.allowed(url)) {
            throw new FeedException(FeedAddress.INVALID);
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(20))
            .header("User-Agent", "Mordi")
            .header("Accept", "text/calendar")
            .GET()
            .build();
        HttpResponse<InputStream> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException e) {
            throw new FeedException(UNREACHABLE);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FeedException(UNREACHABLE);
        }
        try (InputStream body = response.body()) {
            int status = response.statusCode();
            // A secret address that was reset, or a calendar that was deleted
            // or unshared. The copies already here stay until it is fixed.
            if (status == 401 || status == 403 || status == 404 || status == 410) {
                throw new FeedException(GONE);
            }
            if (status != 200) {
                throw new FeedException("Google Calendar answered with an error (" + status
                    + "). Mordi will try again in 15 minutes.");
            }
            return readCapped(body, MAX_BYTES);
        } catch (IOException e) {
            throw new FeedException(UNREACHABLE);
        }
    }

    /**
     * Up to {@code max} bytes as UTF-8, which is what iCalendar is. Stops
     * reading at the first byte past it rather than buffering the rest.
     */
    static String readCapped(InputStream in, int max) throws IOException, FeedException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024);
        byte[] buffer = new byte[16 * 1024];
        int total = 0;
        int n;
        while ((n = in.read(buffer)) != -1) {
            total += n;
            if (total > max) {
                throw new FeedException(TOO_BIG);
            }
            out.write(buffer, 0, n);
        }
        return out.toString(StandardCharsets.UTF_8);
    }
}
