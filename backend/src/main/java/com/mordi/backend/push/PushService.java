package com.mordi.backend.push;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.PushSubscription;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.PushSubscriptionRepository;
import com.mordi.backend.repository.UserRepository;
import java.security.GeneralSecurityException;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opt-in reminders by Web Push: subscriptions, the reminder hour, and the
 * once-a-day send. Everything here is inert until VAPID keys are configured.
 */
@Service
@RequiredArgsConstructor
public class PushService {

    @Data
    public static class SubscribeRequest {
        private String endpoint;
        private Keys keys;
        private String timeZone;

        @Data
        public static class Keys {
            private String p256dh;
            private String auth;
        }
    }

    @Data
    public static class ReminderRequest {
        /** 0-23, or null to switch reminders off. */
        private Integer hour;
        private String timeZone;
    }

    private final WebPushSender sender;
    private final PushSubscriptionRepository subscriptions;
    private final UserRepository users;
    private final GoalRepository goals;
    private final BehaviorRepository behaviors;
    private final ObjectMapper json;

    public Map<String, Object> config(String email) {
        User user = findUser(email);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", sender.enabled());
        out.put("publicKey", sender.publicKey());
        out.put("reminderHour", user.getReminderHour());
        out.put("timeZone", user.getTimeZone());
        out.put("subscriptions", subscriptions.countByUser(user));
        return out;
    }

    @Transactional
    public void subscribe(String email, SubscribeRequest request) {
        requireEnabled();
        if (request == null || request.getEndpoint() == null || request.getKeys() == null) {
            throw new IllegalArgumentException("A subscription needs an endpoint and keys");
        }
        if (!WebPushSender.allowedEndpoint(request.getEndpoint()) || request.getEndpoint().length() > 1000) {
            throw new IllegalArgumentException("That is not a known push service");
        }
        String p256dh = request.getKeys().getP256dh();
        String auth = request.getKeys().getAuth();
        try {
            WebPushCrypto.publicKey(WebPushCrypto.decode(p256dh));
            if (WebPushCrypto.decode(auth).length != 16) {
                throw new IllegalArgumentException("Bad auth secret");
            }
        } catch (GeneralSecurityException | IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("The subscription's keys are not valid");
        }
        User user = findUser(email);
        if (request.getTimeZone() != null) {
            user.setTimeZone(validZone(request.getTimeZone()));
            users.save(user);
        }
        // One endpoint belongs to one browser: re-subscribing moves it to
        // whoever is signed in there now.
        PushSubscription sub = subscriptions.findByEndpoint(request.getEndpoint()).orElseGet(PushSubscription::new);
        sub.setUser(user);
        sub.setEndpoint(request.getEndpoint());
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        subscriptions.save(sub);
    }

    @Transactional
    public void unsubscribe(String email, String endpoint) {
        User user = findUser(email);
        subscriptions.findByEndpoint(endpoint)
            .filter(s -> s.getUser().getId().equals(user.getId()))
            .ifPresent(subscriptions::delete);
    }

    @Transactional
    public Map<String, Object> setReminder(String email, ReminderRequest request) {
        User user = findUser(email);
        Integer hour = request == null ? null : request.getHour();
        if (hour != null && (hour < 0 || hour > 23)) {
            throw new IllegalArgumentException("Hour must be between 0 and 23");
        }
        if (request != null && request.getTimeZone() != null) {
            user.setTimeZone(validZone(request.getTimeZone()));
        }
        user.setReminderHour(hour == null ? null : hour.shortValue());
        users.save(user);
        return config(email);
    }

    /** Sends a test message to every browser the person subscribed. */
    @Transactional
    public int sendTest(String email) {
        requireEnabled();
        User user = findUser(email);
        return deliver(user, new ReminderComposer.Reminder("Reminders are on",
            "You'll hear from Mordi once a day, only when a goal still has days left to fill."));
    }

    /**
     * The scheduler's tick: everyone whose reminder hour has come round in
     * their own zone, and who has not had today's yet, gets one, provided
     * something is actually left to do this week.
     */
    @Transactional
    public int tick(Instant now) {
        if (!sender.enabled()) {
            return 0;
        }
        int sent = 0;
        for (User user : users.findByReminderHourIsNotNull()) {
            if (!isDue(user, now)) {
                continue;
            }
            LocalDate today = now.atZone(zoneOf(user)).toLocalDate();
            user.setLastRemindedOn(today);
            users.save(user);
            ReminderComposer.Reminder reminder = composeFor(user, today);
            if (reminder != null) {
                sent += deliver(user, reminder);
            }
        }
        return sent;
    }

    static boolean isDue(User user, Instant now) {
        if (user.getReminderHour() == null) {
            return false;
        }
        ZonedDateTime local = now.atZone(zoneOf(user));
        return local.getHour() == user.getReminderHour() && !local.toLocalDate().equals(user.getLastRemindedOn());
    }

    ReminderComposer.Reminder composeFor(User user, LocalDate today) {
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        List<Goal> current = goals.findByUserAndActiveTrueAndArchivedAtIsNull(user);
        Map<Long, Set<LocalDate>> done = new HashMap<>();
        for (Behavior b : behaviors.findByUserAndLogDateBetween(user, monday, today)) {
            if (b.isCompleted() && b.getGoal() != null) {
                done.computeIfAbsent(b.getGoal().getId(), k -> new HashSet<>()).add(b.getLogDate());
            }
        }
        List<ReminderComposer.GoalProgress> progress = new ArrayList<>();
        for (Goal g : current) {
            progress.add(new ReminderComposer.GoalProgress(g.getTitle(), g.getTargetPerWeek(),
                done.getOrDefault(g.getId(), Set.of())));
        }
        return ReminderComposer.compose(progress, today);
    }

    /**
     * Anything else worth a notification, such as a message in a shared goal,
     * to every browser the person subscribed. Nothing at all when push is not
     * set up on this server or the person never turned it on.
     */
    public int notify(User user, String title, String body, String url, String tag) {
        if (!sender.enabled()) {
            return 0;
        }
        return deliver(user, title, body, url, tag);
    }

    private int deliver(User user, ReminderComposer.Reminder reminder) {
        return deliver(user, reminder.title(), reminder.body(), "/dashboard", "mordi-week");
    }

    private int deliver(User user, String title, String body, String url, String tag) {
        String payload;
        try {
            payload = json.writeValueAsString(Map.of(
                "title", title,
                "body", body,
                "url", url,
                "tag", tag));
        } catch (JsonProcessingException e) {
            return 0;
        }
        int sent = 0;
        for (PushSubscription sub : subscriptions.findByUser(user)) {
            WebPushSender.Result result = sender.send(sub, payload);
            if (result == WebPushSender.Result.SENT) {
                sent++;
            } else if (result == WebPushSender.Result.GONE) {
                // The browser unsubscribed or the subscription expired.
                subscriptions.delete(sub);
            }
        }
        return sent;
    }

    private void requireEnabled() {
        if (!sender.enabled()) {
            throw new IllegalArgumentException("Reminders are not set up on this server");
        }
    }

    private static ZoneId zoneOf(User user) {
        try {
            return user.getTimeZone() == null ? ZoneOffset.UTC : ZoneId.of(user.getTimeZone());
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }

    private static String validZone(String zone) {
        try {
            return ZoneId.of(zone.trim()).getId();
        } catch (DateTimeException e) {
            throw new IllegalArgumentException("Unknown time zone: " + zone);
        }
    }

    private User findUser(String email) {
        return users.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
