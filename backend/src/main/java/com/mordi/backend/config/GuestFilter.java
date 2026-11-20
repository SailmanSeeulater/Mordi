package com.mordi.backend.config;

import com.mordi.backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

/**
 * What a guest ("Try it") account may not do, and how much it may hold.
 *
 * Turned off: anything that reaches other people or the world outside, or
 * that a deleted-in-a-week account would only lose. Sharing a goal, joining
 * one and writing in its thread (other people, and a way to send spam);
 * connecting a Google Calendar (the server fetches an address it is given,
 * every fifteen minutes); reminders; and changing a password it never had.
 * Reading those pages still works, so they can say what saving would unlock.
 *
 * Capped: making anything new once the account holds mordi.guest.max-items
 * things in all, so a guest cannot be used as free storage.
 *
 * Both answer 403 with a "guest" field, "blocked" or "full", which the app
 * reads to offer saving the account rather than show an error.
 */
@Component
public class GuestFilter extends OncePerRequestFilter {

    /** The authority JwtFilter gives a guest account's requests. */
    public static final GrantedAuthority GUEST = new SimpleGrantedAuthority("GUEST");

    static final List<String> BLOCKED = List.of(
        "POST /api/goals/*/invites",
        "POST /api/invites/accept",
        "POST /api/goals/*/messages",
        "POST /api/calendar-feeds",
        "PATCH /api/calendar-feeds/*",
        "POST /api/calendar-feeds/*/sync",
        "POST /api/push/subscribe",
        "PUT /api/push/reminder",
        "POST /api/push/test",
        "PUT /api/account/password");

    static final List<String> CAPPED = List.of(
        "POST /api/goals",
        "POST /api/behaviors",
        "POST /api/todos",
        "POST /api/notes",
        "POST /api/locations",
        "POST /api/events",
        "POST /api/events/import",
        "POST /api/categories");

    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    // The user table rather than GuestService, which needs the password
    // encoder from SecurityConfig, which needs this filter.
    private final UserRepository users;
    private final int maxItems;

    public GuestFilter(UserRepository users, @Value("${mordi.guest.max-items:500}") int maxItems) {
        this.users = users;
        this.maxItems = maxItems;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.getAuthorities().contains(GUEST)) {
            filterChain.doFilter(request, response);
            return;
        }

        String route = request.getMethod().toUpperCase() + " " + path(request);
        if (matches(BLOCKED, route)) {
            refuse(response, "blocked", "Save your account to use this. It's free and keeps everything you've made.");
            return;
        }
        if (matches(CAPPED, route) && itemCount(auth.getName()) >= maxItems) {
            refuse(response, "full", "The demo holds up to " + maxItems
                + " things. Save your account to keep going.");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private long itemCount(String email) {
        return users.findByEmail(email).map(user -> users.countItems(user.getId())).orElse(0L);
    }

    private static boolean matches(List<String> routes, String route) {
        return routes.stream().anyMatch(pattern -> MATCHER.match(pattern, route));
    }

    /** Decoded, without a trailing slash, as RateLimitFilter reads it. */
    private static String path(HttpServletRequest request) {
        String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
        while (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path;
    }

    private static void refuse(HttpServletResponse response, String why, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
            "{\"status\":403,\"guest\":\"" + why + "\",\"error\":\"" + message.replace("\"", "\\\"") + "\"}");
    }
}
