package com.mordi.backend.feeds;

/**
 * A feed that could not be fetched or read. The message is the short
 * sentence the person sees under the calendar's name, and never includes the
 * address.
 */
public class FeedException extends Exception {
    public FeedException(String message) {
        super(message);
    }
}
