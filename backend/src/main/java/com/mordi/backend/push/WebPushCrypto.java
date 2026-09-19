package com.mordi.backend.push;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * The two pieces of cryptography Web Push needs, with nothing but the JDK:
 *
 * <ul>
 *   <li>Message encryption, RFC 8291 (aes128gcm): an ephemeral P-256 key
 *       agreed with the browser's key, stretched with its auth secret through
 *       HKDF-SHA-256 into a content key and nonce for AES-128-GCM.</li>
 *   <li>VAPID, RFC 8292: a short-lived ES256 JWT that tells the push service
 *       which server is sending, signed with this server's key pair.</li>
 * </ul>
 *
 * The browser-side decryption is here too, only so the tests can prove the
 * two sides agree, including on the RFC's own worked example.
 */
public final class WebPushCrypto {

    private static final ECParameterSpec P256;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder B64U = Base64.getUrlEncoder().withoutPadding();

    static {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"));
            P256 = ((ECPublicKey) g.generateKeyPair().getPublic()).getParams();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("P-256 is not available in this JVM", e);
        }
    }

    private WebPushCrypto() {
    }

    /* ── Encoding ─────────────────────────────────────────────────────── */

    /** Base64url, padded or not, from either alphabet. */
    public static byte[] decode(String value) {
        String s = value.trim().replace('+', '-').replace('/', '_').replaceAll("=+$", "");
        return Base64.getUrlDecoder().decode(s);
    }

    public static String encode(byte[] bytes) {
        return B64U.encodeToString(bytes);
    }

    /** An uncompressed P-256 point (0x04 || X || Y) as a public key. */
    public static ECPublicKey publicKey(byte[] uncompressed) throws GeneralSecurityException {
        if (uncompressed.length != 65 || uncompressed[0] != 0x04) {
            throw new GeneralSecurityException("Not an uncompressed P-256 point");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(uncompressed, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(uncompressed, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
    }

    public static ECPrivateKey privateKey(byte[] d) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d), P256));
    }

    public static byte[] uncompressed(ECPublicKey key) {
        return concat(new byte[] {0x04}, fixed32(key.getW().getAffineX()), fixed32(key.getW().getAffineY()));
    }

    public static KeyPair newKeyPair() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
            return g.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public static byte[] randomSalt() {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return salt;
    }

    private static byte[] fixed32(BigInteger v) {
        byte[] raw = v.toByteArray();
        if (raw.length == 32) {
            return raw;
        }
        byte[] out = new byte[32];
        int from = Math.max(0, raw.length - 32);
        System.arraycopy(raw, from, out, 32 - (raw.length - from), raw.length - from);
        return out;
    }

    static byte[] concat(byte[]... parts) {
        int length = 0;
        for (byte[] p : parts) {
            length += p.length;
        }
        ByteBuffer out = ByteBuffer.allocate(length);
        for (byte[] p : parts) {
            out.put(p);
        }
        return out.array();
    }

    private static byte[] hmac(byte[] key, byte[]... parts) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        for (byte[] p : parts) {
            mac.update(p);
        }
        return mac.doFinal();
    }

    private static final byte[] ONE = {0x01};
    private static final byte[] KEY_INFO = "WebPush: info\0".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] CEK_INFO = "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] NONCE_INFO = "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII);
    private static final int RECORD_SIZE = 4096;

    /** Content key and nonce, derived identically on both sides (RFC 8291 section 3.3-3.4). */
    private static byte[][] keys(byte[] ecdh, byte[] authSecret, byte[] uaPublic, byte[] asPublic, byte[] salt)
            throws GeneralSecurityException {
        byte[] prkKey = hmac(authSecret, ecdh);
        byte[] ikm = hmac(prkKey, KEY_INFO, uaPublic, asPublic, ONE);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, CEK_INFO, ONE), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, NONCE_INFO, ONE), 12);
        return new byte[][] {cek, nonce};
    }

    private static byte[] ecdh(ECPrivateKey mine, ECPublicKey theirs) throws GeneralSecurityException {
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(mine);
        ka.doPhase(theirs, true);
        return ka.generateSecret();
    }

    /**
     * Encrypts one push message for one browser, as a single aes128gcm record:
     * header (salt, record size, this server's ephemeral public key) then the
     * ciphertext of the payload followed by the last-record delimiter 0x02.
     */
    public static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret, KeyPair asKeys, byte[] salt)
            throws GeneralSecurityException {
        if (plaintext.length > RECORD_SIZE - 17 - 86) {
            throw new GeneralSecurityException("Push payload too large");
        }
        byte[] asPublic = uncompressed((ECPublicKey) asKeys.getPublic());
        byte[] secret = ecdh((ECPrivateKey) asKeys.getPrivate(), publicKey(uaPublic));
        byte[][] k = keys(secret, authSecret, uaPublic, asPublic, salt);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(k[0], "AES"), new GCMParameterSpec(128, k[1]));
        byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[] {0x02}));
        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length)
            .put(salt)
            .putInt(RECORD_SIZE)
            .put((byte) asPublic.length)
            .put(asPublic);
        return concat(header.array(), ciphertext);
    }

    /** The browser's side of {@link #encrypt}. Used by the tests only. */
    public static byte[] decrypt(byte[] body, ECPrivateKey uaPrivate, byte[] uaPublic, byte[] authSecret)
            throws GeneralSecurityException {
        ByteBuffer in = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        in.get(salt);
        in.getInt();
        byte[] asPublic = new byte[in.get() & 0xff];
        in.get(asPublic);
        byte[] ciphertext = new byte[in.remaining()];
        in.get(ciphertext);
        byte[] secret = ecdh(uaPrivate, publicKey(asPublic));
        byte[][] k = keys(secret, authSecret, uaPublic, asPublic, salt);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(k[0], "AES"), new GCMParameterSpec(128, k[1]));
        byte[] padded = cipher.doFinal(ciphertext);
        int end = padded.length - 1;
        while (end >= 0 && padded[end] == 0) {
            end--;
        }
        if (end < 0 || padded[end] != 0x02) {
            throw new GeneralSecurityException("Missing record delimiter");
        }
        return Arrays.copyOf(padded, end);
    }

    /**
     * The VAPID token (RFC 8292): an ES256 JWT naming the push service as its
     * audience, expiring within a day, with a contact for the sender.
     */
    public static String vapidToken(String audience, String subject, long expiresEpochSeconds, ECPrivateKey key)
            throws GeneralSecurityException {
        String header = encode("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = encode(("{\"aud\":\"" + audience + "\",\"exp\":" + expiresEpochSeconds
            + ",\"sub\":\"" + subject + "\"}").getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + claims;
        // P1363 gives the raw 64-byte r||s a JWT expects, not DER.
        Signature signer = Signature.getInstance("SHA256withECDSAinP1363Format");
        signer.initSign(key);
        signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        return signingInput + "." + encode(signer.sign());
    }
}
