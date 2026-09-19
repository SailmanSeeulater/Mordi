package com.mordi.backend.push;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Base64;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebPushCryptoTest {

    // RFC 8291, Appendix A: the worked example of one encrypted push message.
    private static final String PLAINTEXT = "When I grow up, I want to be a watermelon";
    private static final String AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    private static final String AS_PUBLIC =
        "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    private static final String UA_PRIVATE = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
    private static final String UA_PUBLIC =
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    private static final String SALT = "DGv6ra1nlYgDCS1FRnbzlw";
    private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
    private static final String BODY =
        "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_"
            + "yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

    private static byte[] b(String s) {
        return WebPushCrypto.decode(s);
    }

    @Test
    void encryptsTheRfcExampleByteForByte() throws Exception {
        KeyPair as = new KeyPair(WebPushCrypto.publicKey(b(AS_PUBLIC)), WebPushCrypto.privateKey(b(AS_PRIVATE)));

        byte[] body = WebPushCrypto.encrypt(
            PLAINTEXT.getBytes(StandardCharsets.UTF_8), b(UA_PUBLIC), b(AUTH), as, b(SALT));

        assertThat(WebPushCrypto.encode(body)).isEqualTo(BODY);
    }

    @Test
    void decryptsTheRfcExampleAsTheBrowserWould() throws Exception {
        byte[] plain = WebPushCrypto.decrypt(b(BODY), WebPushCrypto.privateKey(b(UA_PRIVATE)), b(UA_PUBLIC), b(AUTH));

        assertThat(new String(plain, StandardCharsets.UTF_8)).isEqualTo(PLAINTEXT);
    }

    @Test
    void roundTripsWithFreshKeysAndSalt() throws Exception {
        KeyPair browser = WebPushCrypto.newKeyPair();
        byte[] uaPublic = WebPushCrypto.uncompressed((ECPublicKey) browser.getPublic());
        byte[] auth = WebPushCrypto.randomSalt();
        String message = "{\"title\":\"This week so far\",\"body\":\"Run: 2 of 4 left\"}";

        byte[] body = WebPushCrypto.encrypt(message.getBytes(StandardCharsets.UTF_8), uaPublic, auth,
            WebPushCrypto.newKeyPair(), WebPushCrypto.randomSalt());

        byte[] plain = WebPushCrypto.decrypt(body, (ECPrivateKey) browser.getPrivate(), uaPublic, auth);
        assertThat(new String(plain, StandardCharsets.UTF_8)).isEqualTo(message);
    }

    @Test
    void refusesAKeyThatIsNotAnUncompressedPoint() {
        assertThatThrownBy(() -> WebPushCrypto.publicKey(new byte[33]))
            .isInstanceOf(java.security.GeneralSecurityException.class);
    }

    @Test
    void signsAVapidTokenTheServerKeyVerifies() throws Exception {
        KeyPair server = WebPushCrypto.newKeyPair();

        String jwt = WebPushCrypto.vapidToken("https://fcm.googleapis.com", "mailto:ops@example.com", 1_900_000_000L,
            (ECPrivateKey) server.getPrivate());

        String[] parts = jwt.split("\\.");
        assertThat(parts).hasSize(3);
        String claims = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        assertThat(claims).contains("\"aud\":\"https://fcm.googleapis.com\"").contains("\"exp\":1900000000");
        byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
        assertThat(signature).hasSize(64); // raw r||s, as JWS ES256 requires
        Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(server.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(signature)).isTrue();
    }
}
