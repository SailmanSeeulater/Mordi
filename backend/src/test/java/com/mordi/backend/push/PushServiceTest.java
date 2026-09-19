package com.mordi.backend.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.PushSubscription;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.PushSubscriptionRepository;
import com.mordi.backend.repository.UserRepository;
import java.security.KeyPair;
import java.security.interfaces.ECPublicKey;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PushServiceTest {

    private static final String ME = "sailor@mordi.com";
    // 19:05 on Thursday 17 September 2026 in Los Angeles (UTC-7).
    private static final Instant EVENING_LA = Instant.parse("2026-09-18T02:05:00Z");

    @Mock private WebPushSender sender;
    @Mock private PushSubscriptionRepository subscriptions;
    @Mock private UserRepository users;
    @Mock private GoalRepository goals;
    @Mock private BehaviorRepository behaviors;

    private PushService service;
    private User me;

    @BeforeEach
    void setUp() {
        service = new PushService(sender, subscriptions, users, goals, behaviors, new ObjectMapper());
        me = new User();
        me.setId(1L);
        me.setEmail(ME);
        me.setTimeZone("America/Los_Angeles");
        me.setReminderHour((short) 19);
        when(users.findByEmail(ME)).thenReturn(Optional.of(me));
        when(sender.enabled()).thenReturn(true);
    }

    private static String validP256dh() {
        KeyPair browser = WebPushCrypto.newKeyPair();
        return WebPushCrypto.encode(WebPushCrypto.uncompressed((ECPublicKey) browser.getPublic()));
    }

    private static PushService.SubscribeRequest request(String endpoint, String p256dh, String auth) {
        PushService.SubscribeRequest r = new PushService.SubscribeRequest();
        r.setEndpoint(endpoint);
        PushService.SubscribeRequest.Keys keys = new PushService.SubscribeRequest.Keys();
        keys.setP256dh(p256dh);
        keys.setAuth(auth);
        r.setKeys(keys);
        r.setTimeZone("America/Los_Angeles");
        return r;
    }

    @Test
    void isDueAtTheHourInThePersonsOwnZoneOnceADay() {
        assertThat(PushService.isDue(me, EVENING_LA)).isTrue();
        // 19:05 UTC is noon in Los Angeles: not their hour.
        assertThat(PushService.isDue(me, Instant.parse("2026-09-17T19:05:00Z"))).isFalse();
        me.setLastRemindedOn(LocalDate.of(2026, 9, 17));
        assertThat(PushService.isDue(me, EVENING_LA)).isFalse();
        me.setReminderHour(null);
        assertThat(PushService.isDue(me, EVENING_LA)).isFalse();
    }

    @Test
    void acceptsOnlyRealPushServicesOverHttps() {
        assertThat(WebPushSender.allowedEndpoint("https://fcm.googleapis.com/fcm/send/abc")).isTrue();
        assertThat(WebPushSender.allowedEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).isTrue();
        assertThat(WebPushSender.allowedEndpoint("https://web.push.apple.com/QK")).isTrue();
        assertThat(WebPushSender.allowedEndpoint("https://db5p.notify.windows.com/w/?token=x")).isTrue();
        // An internal address, plain http, a look-alike host, credentials in the URL.
        assertThat(WebPushSender.allowedEndpoint("https://localhost:8080/api/admin")).isFalse();
        assertThat(WebPushSender.allowedEndpoint("http://fcm.googleapis.com/fcm/send/abc")).isFalse();
        assertThat(WebPushSender.allowedEndpoint("https://fcm.googleapis.com.evil.example/x")).isFalse();
        assertThat(WebPushSender.allowedEndpoint("https://user@fcm.googleapis.com/x")).isFalse();
        assertThat(WebPushSender.allowedEndpoint("not a url")).isFalse();
    }

    @Test
    void storesAValidSubscriptionAndTheZone() {
        when(subscriptions.findByEndpoint(anyString())).thenReturn(Optional.empty());

        service.subscribe(ME, request("https://fcm.googleapis.com/fcm/send/abc", validP256dh(),
            WebPushCrypto.encode(new byte[16])));

        verify(subscriptions).save(any(PushSubscription.class));
        assertThat(me.getTimeZone()).isEqualTo("America/Los_Angeles");
    }

    @Test
    void refusesBadEndpointsAndKeys() {
        assertThatThrownBy(() -> service.subscribe(ME, request("https://10.0.0.5/x", validP256dh(),
            WebPushCrypto.encode(new byte[16])))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.subscribe(ME, request("https://fcm.googleapis.com/x", "bm9wZQ",
            WebPushCrypto.encode(new byte[16])))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.subscribe(ME, request("https://fcm.googleapis.com/x", validP256dh(),
            WebPushCrypto.encode(new byte[8])))).isInstanceOf(IllegalArgumentException.class);
        verify(subscriptions, never()).save(any());
    }

    @Test
    void refusesToSubscribeWhenPushIsNotConfigured() {
        when(sender.enabled()).thenReturn(false);
        assertThatThrownBy(() -> service.subscribe(ME, request("https://fcm.googleapis.com/x", validP256dh(),
            WebPushCrypto.encode(new byte[16])))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validatesTheReminderHourAndZone() {
        PushService.ReminderRequest bad = new PushService.ReminderRequest();
        bad.setHour(24);
        assertThatThrownBy(() -> service.setReminder(ME, bad)).isInstanceOf(IllegalArgumentException.class);
        PushService.ReminderRequest zone = new PushService.ReminderRequest();
        zone.setHour(8);
        zone.setTimeZone("Mars/Olympus_Mons");
        assertThatThrownBy(() -> service.setReminder(ME, zone)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void tickSendsOnceAndForgetsSubscriptionsThatAreGone() {
        Goal run = new Goal();
        run.setId(3L);
        run.setTitle("Run");
        run.setTargetPerWeek(4);
        when(users.findByReminderHourIsNotNull()).thenReturn(List.of(me));
        when(goals.findByUserAndActiveTrueAndArchivedAtIsNull(me)).thenReturn(List.of(run));
        when(behaviors.findByUserAndLogDateBetween(any(), any(), any())).thenReturn(List.of());
        PushSubscription alive = new PushSubscription();
        alive.setEndpoint("https://fcm.googleapis.com/a");
        PushSubscription gone = new PushSubscription();
        gone.setEndpoint("https://fcm.googleapis.com/b");
        when(subscriptions.findByUser(me)).thenReturn(List.of(alive, gone));
        when(sender.send(eqSub(alive), anyString())).thenReturn(WebPushSender.Result.SENT);
        when(sender.send(eqSub(gone), anyString())).thenReturn(WebPushSender.Result.GONE);

        assertThat(service.tick(EVENING_LA)).isEqualTo(1);
        verify(subscriptions).delete(gone);
        assertThat(me.getLastRemindedOn()).isEqualTo(LocalDate.of(2026, 9, 17));

        // A second tick in the same hour sends nothing.
        assertThat(service.tick(EVENING_LA.plusSeconds(900))).isZero();
    }

    @Test
    void tickIsSilentWhenNothingIsLeftThisWeek() {
        when(users.findByReminderHourIsNotNull()).thenReturn(List.of(me));
        when(goals.findByUserAndActiveTrueAndArchivedAtIsNull(me)).thenReturn(List.of());

        assertThat(service.tick(EVENING_LA)).isZero();
        verify(sender, never()).send(any(), anyString());
        // Still marked, so it does not re-check every quarter hour all evening.
        assertThat(me.getLastRemindedOn()).isEqualTo(LocalDate.of(2026, 9, 17));
    }

    private static PushSubscription eqSub(PushSubscription s) {
        return org.mockito.ArgumentMatchers.argThat(x -> x == s);
    }
}
