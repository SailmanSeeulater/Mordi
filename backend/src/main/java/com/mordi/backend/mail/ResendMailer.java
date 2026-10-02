package com.mordi.backend.mail;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Sends email through Resend's HTTP API.
 *
 * Off unless RESEND_API_KEY is set. Then nothing goes out and each message is
 * logged in full instead, link included, which is how a password reset is
 * exercised on a laptop with no mail account behind it.
 */
@Slf4j
@Component
public class ResendMailer {

    public enum Result { SENT, SKIPPED, FAILED }

    static final URI ENDPOINT = URI.create("https://api.resend.com/emails");

    private final String apiKey;
    private final String from;
    private final ObjectMapper json;
    private final HttpClient http;

    @Autowired
    public ResendMailer(
            @Value("${mordi.mail.resend-api-key:}") String apiKey,
            @Value("${mordi.mail.from:Mordi <hello@latesailor.dev>}") String from,
            ObjectMapper json) {
        this(apiKey, from, json, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    /** For tests, so the request can be inspected without reaching Resend. */
    ResendMailer(String apiKey, String from, ObjectMapper json, HttpClient http) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.from = from;
        this.json = json;
        this.http = http;
    }

    public boolean enabled() {
        return !apiKey.isBlank();
    }

    /**
     * On a worker thread: the request that caused the mail should not wait on
     * Resend, and a mail that fails must not fail the request.
     */
    @Async
    public void send(Email email) {
        deliver(email);
    }

    Result deliver(Email email) {
        if (!enabled()) {
            log.info("Mail is off (no RESEND_API_KEY). Not sent to {}: \"{}\"\n{}",
                email.to(), email.subject(), email.text());
            return Result.SKIPPED;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(ENDPOINT)
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body(email)))
                .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return Result.SENT;
            }
            // The body names the reason (an unverified domain, say); the
            // recipient stays out of the log.
            log.warn("Resend answered {} for \"{}\": {}", response.statusCode(), email.subject(), response.body());
            return Result.FAILED;
        } catch (IOException e) {
            log.warn("Could not reach Resend for \"{}\": {}", email.subject(), e.getMessage());
            return Result.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.FAILED;
        }
    }

    /** The request body, in the field names Resend's POST /emails expects. */
    String body(Email email) throws JsonProcessingException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("from", from);
        payload.put("to", email.to());
        payload.put("subject", email.subject());
        payload.put("text", email.text());
        if (email.html() != null) {
            payload.put("html", email.html());
        }
        return json.writeValueAsString(payload);
    }
}
