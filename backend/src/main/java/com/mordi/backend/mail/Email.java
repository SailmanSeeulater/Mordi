package com.mordi.backend.mail;

/** One message to one person, in both forms a mail client might show. */
public record Email(String to, String subject, String text, String html) {}
