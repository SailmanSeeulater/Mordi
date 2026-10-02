package com.mordi.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Random tokens for cookies and links, and the hash they are stored under.
 * Shared by refresh tokens and one-time links so both are made the same way.
 */
final class Tokens {

    /** 256 bits: not guessable, and far more than a hash collision needs. */
    private static final int BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private Tokens() {}

    /** A fresh token, base64url without padding, so it is safe in a URL. */
    static String random() {
        byte[] bytes = new byte[BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * SHA-256, not a password hash. The input is 256 random bits, so there is
     * nothing for a slow hash to protect against, and lookups need to be
     * deterministic.
     */
    static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // Every JVM is required to provide SHA-256.
            throw new IllegalStateException(e);
        }
    }
}
