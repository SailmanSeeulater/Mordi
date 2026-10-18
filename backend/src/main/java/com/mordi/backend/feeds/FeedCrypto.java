package com.mordi.backend.feeds;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Keeps calendar addresses unreadable at rest. A Google secret address is a
 * credential: whoever has it can read that whole calendar, so a database dump
 * or a backup must not be enough to get it.
 *
 * AES-256-GCM under MORDI_FEED_KEY (base64, 32 bytes), a fresh random 12-byte
 * nonce for every value, stored as base64 of nonce then ciphertext and tag.
 * GCM authenticates as well as encrypts, so a value that was altered, or is
 * read with another key, fails outright instead of decrypting to rubbish.
 *
 * Without a usable key the whole Google Calendar feature is off: see
 * {@link #enabled()}.
 */
@Slf4j
@Component
public class FeedCrypto {

    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKey key;

    public FeedCrypto(@Value("${mordi.feeds.key:}") String base64Key) {
        this.key = parseKey(base64Key);
    }

    private static SecretKey parseKey(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            return null;
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(base64Key.trim());
            if (bytes.length != 32) {
                log.warn("MORDI_FEED_KEY is {} bytes, not 32; Google Calendar sync stays off", bytes.length);
                return null;
            }
            return new SecretKeySpec(bytes, "AES");
        } catch (IllegalArgumentException e) {
            log.warn("MORDI_FEED_KEY is not base64; Google Calendar sync stays off");
            return null;
        }
    }

    public boolean enabled() {
        return key != null;
    }

    public String encrypt(String plain) {
        requireKey();
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            RANDOM.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(
                ByteBuffer.allocate(nonce.length + sealed.length).put(nonce).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt", e);
        }
    }

    /**
     * The value {@link #encrypt} sealed. Throws {@link GeneralSecurityException}
     * when it was sealed under another key or has been changed since.
     */
    public String decrypt(String sealed) throws GeneralSecurityException {
        requireKey();
        byte[] all;
        try {
            all = Base64.getDecoder().decode(sealed);
        } catch (IllegalArgumentException e) {
            throw new GeneralSecurityException("Not base64");
        }
        if (all.length < NONCE_BYTES + TAG_BITS / 8) {
            throw new GeneralSecurityException("Too short");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, all, 0, NONCE_BYTES));
        byte[] plain = cipher.doFinal(all, NONCE_BYTES, all.length - NONCE_BYTES);
        return new String(plain, StandardCharsets.UTF_8);
    }

    /** SHA-256, as 64 hex digits: the same address always gives the same hash. */
    public static String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new IllegalStateException("MORDI_FEED_KEY is not set");
        }
    }
}
