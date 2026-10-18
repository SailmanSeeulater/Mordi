package com.mordi.backend.service;

import java.time.DayOfWeek;

/**
 * A goal's planned weekdays as a 7-bit mask: bit 0 is Monday, bit 6 Sunday,
 * ISO order whatever day the person's calendar starts on. Null or 0 means no
 * planned days, and any day of the week counts.
 */
public final class PlannedDays {

    public static final int ALL = 0b111_1111;

    private PlannedDays() {
    }

    /** Whether `mask` plans `day`. False for a goal with no planned days. */
    public static boolean includes(Short mask, DayOfWeek day) {
        return mask != null && (mask & (1 << (day.getValue() - 1))) != 0;
    }

    /** How many days the mask plans: the goal's weekly target when set. */
    public static int count(Short mask) {
        return mask == null ? 0 : Integer.bitCount(mask & ALL);
    }

    /**
     * A requested mask as stored: null for none (0 clears), else 1 to 127.
     * Anything outside 0 to 127 is refused.
     */
    public static Short valid(Integer requested) {
        if (requested == null || requested == 0) {
            return null;
        }
        if (requested < 0 || requested > ALL) {
            throw new IllegalArgumentException("Planned days must be a weekday mask from 0 to 127");
        }
        return requested.shortValue();
    }
}
