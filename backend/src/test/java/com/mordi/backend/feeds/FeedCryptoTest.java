package com.mordi.backend.feeds;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedCryptoTest {

    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);
    private static final String OTHER_KEY = Base64.getEncoder()
        .encodeToString("another key of 32 bytes exactly!".getBytes(StandardCharsets.US_ASCII));
    private static final String URL =
        "https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef0123456789abcdef/basic.ics";

    @Test
    void roundTripsAndNeverRepeatsACiphertext() throws Exception {
        FeedCrypto crypto = new FeedCrypto(KEY);

        String once = crypto.encrypt(URL);
        String twice = crypto.encrypt(URL);

        assertThat(crypto.enabled()).isTrue();
        assertThat(crypto.decrypt(once)).isEqualTo(URL);
        assertThat(crypto.decrypt(twice)).isEqualTo(URL);
        // A fresh nonce each time, so equal addresses do not look equal at rest.
        assertThat(once).isNotEqualTo(twice);
        assertThat(once).doesNotContain("calendar.google.com");
    }

    @Test
    void theWrongKeyCannotReadIt() {
        String sealed = new FeedCrypto(KEY).encrypt(URL);

        assertThatThrownBy(() -> new FeedCrypto(OTHER_KEY).decrypt(sealed))
            .isInstanceOf(GeneralSecurityException.class);
    }

    @Test
    void aTamperedCiphertextFails() {
        FeedCrypto crypto = new FeedCrypto(KEY);
        byte[] bytes = Base64.getDecoder().decode(crypto.encrypt(URL));
        bytes[bytes.length - 20] ^= 1;
        String tampered = Base64.getEncoder().encodeToString(bytes);

        assertThatThrownBy(() -> crypto.decrypt(tampered)).isInstanceOf(GeneralSecurityException.class);
        assertThatThrownBy(() -> crypto.decrypt("not base64 at all!")).isInstanceOf(GeneralSecurityException.class);
        assertThatThrownBy(() -> crypto.decrypt("AAAA")).isInstanceOf(GeneralSecurityException.class);
    }

    @Test
    void isOffWithoutAUsableKey() {
        assertThat(new FeedCrypto("").enabled()).isFalse();
        assertThat(new FeedCrypto(null).enabled()).isFalse();
        assertThat(new FeedCrypto("not base64!").enabled()).isFalse();
        assertThat(new FeedCrypto(Base64.getEncoder().encodeToString(new byte[16])).enabled()).isFalse();
        assertThatThrownBy(() -> new FeedCrypto("").encrypt(URL)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void hashesTheSameAddressTheSameWay() {
        assertThat(FeedCrypto.hash(URL)).hasSize(64).isEqualTo(FeedCrypto.hash(URL)).matches("[0-9a-f]{64}");
        assertThat(FeedCrypto.hash(URL)).isNotEqualTo(FeedCrypto.hash(URL + "x"));
    }
}
