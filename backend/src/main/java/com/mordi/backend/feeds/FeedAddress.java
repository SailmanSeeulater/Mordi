package com.mordi.backend.feeds;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Which calendar addresses Mordi's server will fetch: Google Calendar's own
 * iCal addresses and nothing else.
 *
 * The server fetches whatever is saved here every fifteen minutes, so this is
 * the same guard as the push service allow-list in WebPushSender: accepting
 * any URL would let anyone point the server at an internal address. The host
 * is fixed, the scheme is https, and the path has to be the exact shape Google
 * hands out, checked by one anchored pattern rather than by taking a URL apart
 * and trusting its pieces.
 */
public final class FeedAddress {

    public static final String INVALID =
        "That isn’t a Google Calendar secret address. In Google Calendar, open Settings, pick the "
            + "calendar, and copy “Secret address in iCal format”.";

    private static final String ORIGIN = "https://calendar.google.com";
    private static final String PREFIX = ORIGIN + "/calendar/ical/";

    /**
     * https://calendar.google.com/calendar/ical/{id}/private-{key}/basic.ics,
     * or .../public/basic.ics for a calendar made public. The id is the
     * calendar's address with @ written %40, as Google writes it.
     */
    private static final Pattern GOOGLE = Pattern.compile(
        "^https://calendar\\.google\\.com/calendar/ical/([A-Za-z0-9._%+\\-]{1,200})/(private-[A-Za-z0-9]{8,128}|public)/basic\\.ics$");

    private FeedAddress() {
    }

    /**
     * The address in the one form it is stored, hashed and fetched in, or an
     * IllegalArgumentException with a message for the person. A webcal://
     * link (what "Add to calendar" buttons often use) is the same feed over
     * https.
     */
    public static String normalise(String input) {
        if (input == null) {
            throw new IllegalArgumentException(INVALID);
        }
        String url = input.strip();
        if (url.length() > 600) {
            throw new IllegalArgumentException(INVALID);
        }
        if (url.regionMatches(true, 0, "webcal://", 0, "webcal://".length())) {
            url = "https://" + url.substring("webcal://".length());
        }
        // Scheme and host are case-blind; the rest is not (the private key is
        // case-sensitive), so only the fixed prefix is folded.
        if (!url.regionMatches(true, 0, PREFIX, 0, PREFIX.length())) {
            throw new IllegalArgumentException(INVALID);
        }
        url = PREFIX + url.substring(PREFIX.length());
        // Google writes the @ in the calendar's id as %40; a copy that came
        // through something that decoded it means the same calendar. The host
        // is already fixed above, so an @ here can only be inside the path.
        int idEnd = url.indexOf('/', PREFIX.length());
        if (idEnd > 0) {
            url = PREFIX + url.substring(PREFIX.length(), idEnd).replace("@", "%40") + url.substring(idEnd);
        }
        if (!GOOGLE.matcher(url).matches() || !sameOrigin(url)) {
            throw new IllegalArgumentException(INVALID);
        }
        return url;
    }

    /** Whether a stored address is still one this server may fetch. */
    public static boolean allowed(String url) {
        return url != null && GOOGLE.matcher(url).matches() && sameOrigin(url);
    }

    /**
     * Belt and braces: Java's own reading of the URL must agree with the
     * pattern about where it goes.
     */
    private static boolean sameOrigin(String url) {
        try {
            URI uri = URI.create(url);
            return "https".equals(uri.getScheme())
                && "calendar.google.com".equals(uri.getHost())
                && uri.getPort() == -1
                && uri.getRawUserInfo() == null
                && uri.getRawQuery() == null
                && uri.getRawFragment() == null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Enough of the address for the person to tell two calendars apart, and
     * not enough to use: "calendar.google.com/…" and the last four characters
     * of the calendar's id, before its @domain (which is the same .com for
     * everyone).
     */
    public static String hint(String url) {
        Matcher m = GOOGLE.matcher(url == null ? "" : url);
        if (!m.matches()) {
            return "calendar.google.com/…";
        }
        String id = URLDecoder.decode(m.group(1), StandardCharsets.UTF_8);
        int at = id.indexOf('@');
        String local = at > 0 ? id.substring(0, at) : id;
        String tail = local.length() <= 4 ? local : local.substring(local.length() - 4);
        return "calendar.google.com/…" + tail.toLowerCase(Locale.ROOT);
    }
}
