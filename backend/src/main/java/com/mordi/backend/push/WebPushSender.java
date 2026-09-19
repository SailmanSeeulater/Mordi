package com.mordi.backend.push;

import com.mordi.backend.model.PushSubscription;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.interfaces.ECPrivateKey;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Delivers one encrypted message to one browser's push service.
 *
 * Push is off unless both VAPID keys are configured (VAPID_PUBLIC_KEY and
 * VAPID_PRIVATE_KEY); every entry point checks {@link #enabled()} first.
 */
@Slf4j
@Component
public class WebPushSender {

    public enum Result { SENT, GONE, FAILED }

    /**
     * The push services browsers actually use. A subscription endpoint is a
     * URL the browser hands us and the server later POSTs to; accepting any
     * URL would let anyone point this server at an internal address.
     */
    static final List<String> PUSH_HOSTS = List.of(
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
        ".push.apple.com",
        ".notify.windows.com");

    private final String publicKey;
    private final ECPrivateKey privateKey;
    private final String subject;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public WebPushSender(
            @Value("${mordi.push.vapid-public-key:}") String publicKey,
            @Value("${mordi.push.vapid-private-key:}") String privateKey,
            @Value("${mordi.push.subject:mailto:hello@latesailor.dev}") String subject) {
        ECPrivateKey key = null;
        String pub = null;
        if (!publicKey.isBlank() && !privateKey.isBlank()) {
            try {
                WebPushCrypto.publicKey(WebPushCrypto.decode(publicKey));
                key = WebPushCrypto.privateKey(WebPushCrypto.decode(privateKey));
                pub = publicKey.trim();
            } catch (GeneralSecurityException | IllegalArgumentException e) {
                log.warn("VAPID keys are set but unusable; push reminders stay off: {}", e.getMessage());
            }
        }
        this.publicKey = pub;
        this.privateKey = key;
        this.subject = subject;
    }

    public boolean enabled() {
        return privateKey != null;
    }

    public String publicKey() {
        return publicKey;
    }

    /** Whether an endpoint is https on one of the known push services. */
    public static boolean allowedEndpoint(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
                return false;
            }
            String host = uri.getHost().toLowerCase();
            return PUSH_HOSTS.stream().anyMatch(h -> h.startsWith(".") ? host.endsWith(h) : host.equals(h));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public Result send(PushSubscription subscription, String json) {
        if (!enabled() || !allowedEndpoint(subscription.getEndpoint())) {
            return Result.FAILED;
        }
        try {
            byte[] body = WebPushCrypto.encrypt(
                json.getBytes(StandardCharsets.UTF_8),
                WebPushCrypto.decode(subscription.getP256dh()),
                WebPushCrypto.decode(subscription.getAuth()),
                WebPushCrypto.newKeyPair(),
                WebPushCrypto.randomSalt());
            URI uri = URI.create(subscription.getEndpoint());
            String audience = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
            String jwt = WebPushCrypto.vapidToken(audience, subject,
                Instant.now().plus(Duration.ofHours(12)).getEpochSecond(), privateKey);
            HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(15))
                .header("TTL", "43200")
                .header("Urgency", "normal")
                .header("Content-Encoding", "aes128gcm")
                .header("Content-Type", "application/octet-stream")
                .header("Authorization", "vapid t=" + jwt + ", k=" + publicKey)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
            int status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status == 404 || status == 410) {
                return Result.GONE;
            }
            if (status >= 200 && status < 300) {
                return Result.SENT;
            }
            log.warn("Push service answered {} for a subscription", status);
            return Result.FAILED;
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            log.warn("Could not encrypt a push message: {}", e.getMessage());
            return Result.FAILED;
        } catch (java.io.IOException e) {
            log.warn("Push delivery failed: {}", e.getMessage());
            return Result.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.FAILED;
        }
    }
}
