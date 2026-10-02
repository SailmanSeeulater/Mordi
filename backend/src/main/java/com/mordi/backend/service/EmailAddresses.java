package com.mordi.backend.service;

import java.util.Locale;

public final class EmailAddresses {

    private EmailAddresses() {}

    /**
     * The one form every address is stored and looked up in: trimmed and
     * lowercased. The standard allows a case-sensitive local part, but no
     * mail provider in use treats "Ana@" and "ana@" as different mailboxes,
     * and a sign-in that fails on a capital letter is a lost account.
     */
    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
