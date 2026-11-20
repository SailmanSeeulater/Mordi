package com.mordi.backend.service;

import com.mordi.backend.config.JwtUtil;
import com.mordi.backend.dto.AuthRequest;
import com.mordi.backend.dto.AuthResponse;
import com.mordi.backend.dto.GuestRequest;
import com.mordi.backend.exception.EmailAlreadyExistsException;
import com.mordi.backend.exception.GuestsFullException;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestServiceTest {

    // Thursday 19 November 2026, 22:30 UTC: already Friday in Tokyo.
    private static final Instant NOW = Instant.parse("2026-11-19T22:30:00Z");
    private static final LocalDateTime NOW_LOCAL = LocalDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @Mock private UserRepository users;
    @Mock private PasswordEncoder encoder;
    @Mock private JwtUtil jwt;
    @Mock private RefreshTokenService refreshTokens;
    @Mock private ActivityService activity;
    @Mock private GuestSampleWeek sampleWeek;

    private GuestService service;

    @BeforeEach
    void setUp() {
        service = new GuestService(users, encoder, jwt, refreshTokens, activity, sampleWeek,
            Clock.fixed(NOW, ZoneOffset.UTC), Duration.ofDays(7), 500);
    }

    private User saved() {
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(users).save(captor.capture());
        return captor.getValue();
    }

    private static GuestRequest request(String zone, Boolean sample) {
        GuestRequest request = new GuestRequest();
        request.setTimeZone(zone);
        request.setSample(sample);
        return request;
    }

    @Test
    void aGuestIsAMadeUpAccountThatGoesInAWeek() {
        when(encoder.encode(anyString())).thenReturn("hash");
        when(jwt.generateToken(anyString(), any())).thenReturn("token");

        AuthResponse body = service.start(request("Asia/Tokyo", null));

        User guest = saved();
        assertThat(guest.getEmail()).matches("guest-[0-9a-f]{32}@guest\\.invalid");
        assertThat(guest.getName()).isEqualTo("Guest");
        assertThat(guest.getGuestUntil()).isEqualTo(NOW_LOCAL.plusDays(7));
        assertThat(guest.isGuest()).isTrue();
        assertThat(guest.getTermsVersion()).isEqualTo(AuthService.TERMS_VERSION);
        assertThat(body.getGuestUntil()).isEqualTo(NOW_LOCAL.plusDays(7));
        assertThat(body.getToken()).isEqualTo("token");
    }

    @Test
    void theSampleWeekEndsOnThePersonsOwnToday() {
        when(encoder.encode(anyString())).thenReturn("hash");

        service.start(request("Asia/Tokyo", null));

        verify(sampleWeek).fill(any(User.class), org.mockito.ArgumentMatchers.eq(LocalDate.of(2026, 11, 20)));
    }

    @Test
    void anUnknownZoneIsReadAsUtc() {
        when(encoder.encode(anyString())).thenReturn("hash");

        service.start(request("Not/AZone", true));

        assertThat(saved().getTimeZone()).isEqualTo("UTC");
        verify(sampleWeek).fill(any(User.class), org.mockito.ArgumentMatchers.eq(LocalDate.of(2026, 11, 19)));
    }

    @Test
    void askingForAnEmptyAccountSkipsTheSample() {
        when(encoder.encode(anyString())).thenReturn("hash");

        service.start(request(null, false));

        verify(sampleWeek, never()).fill(any(), any());
    }

    @Test
    void noMoreGuestsOnceTheCapIsReached() {
        when(users.countByGuestUntilAfter(NOW_LOCAL)).thenReturn(500L);

        assertThatThrownBy(() -> service.start(null)).isInstanceOf(GuestsFullException.class);
        verify(users, never()).save(any());
    }

    private User guest() {
        User guest = new User();
        guest.setId(9L);
        guest.setEmail("guest-abc" + GuestService.GUEST_DOMAIN);
        guest.setName("Guest");
        guest.setGuestUntil(NOW_LOCAL.plusDays(3));
        return guest;
    }

    private static AuthRequest claim(String email, String name) {
        AuthRequest request = new AuthRequest();
        request.setEmail(email);
        request.setPassword("a-good-password");
        request.setName(name);
        return request;
    }

    @Test
    void savingKeepsTheAccountAndStopsTheClock() {
        User guest = guest();
        when(users.findByEmail(guest.getEmail())).thenReturn(Optional.of(guest));
        when(encoder.encode("a-good-password")).thenReturn("hash");
        when(jwt.generateToken("ana@example.com", 9L)).thenReturn("token");

        AuthResponse body = service.claim(guest.getEmail(), claim(" Ana@Example.com ", "Ana"));

        assertThat(guest.getId()).isEqualTo(9L);
        assertThat(guest.getEmail()).isEqualTo("ana@example.com");
        assertThat(guest.getName()).isEqualTo("Ana");
        assertThat(guest.getPassword()).isEqualTo("hash");
        assertThat(guest.isGuest()).isFalse();
        assertThat(body.getGuestUntil()).isNull();
        assertThat(body.getEmail()).isEqualTo("ana@example.com");
        verify(refreshTokens).revokeAllFor(guest);
    }

    @Test
    void savingWithNoNameUsesTheAddress() {
        User guest = guest();
        when(users.findByEmail(guest.getEmail())).thenReturn(Optional.of(guest));

        service.claim(guest.getEmail(), claim("ana@example.com", "  "));

        assertThat(guest.getName()).isEqualTo("ana");
    }

    @Test
    void anAddressAlreadyInUseIsRefused() {
        User guest = guest();
        when(users.findByEmail(guest.getEmail())).thenReturn(Optional.of(guest));
        when(users.existsByEmail("taken@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.claim(guest.getEmail(), claim("taken@example.com", "T")))
            .isInstanceOf(EmailAlreadyExistsException.class);
        assertThat(guest.isGuest()).isTrue();
        verify(users, never()).save(any());
    }

    @Test
    void aGuestAddressCannotBeSavedAsARealOne() {
        User guest = guest();
        when(users.findByEmail(guest.getEmail())).thenReturn(Optional.of(guest));

        assertThatThrownBy(() -> service.claim(guest.getEmail(), claim("x" + GuestService.GUEST_DOMAIN, "X")))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void anAccountAlreadySavedCannotBeSavedAgain() {
        User saved = guest();
        saved.setGuestUntil(null);
        when(users.findByEmail(saved.getEmail())).thenReturn(Optional.of(saved));

        assertThatThrownBy(() -> service.claim(saved.getEmail(), claim("new@example.com", "N")))
            .isInstanceOf(IllegalArgumentException.class);
        verify(refreshTokens, never()).revokeAllFor(any());
    }

    @Test
    void expiredGuestsAreDeleted() {
        when(users.findIdsByGuestUntilBefore(NOW_LOCAL)).thenReturn(List.of(3L, 4L));

        assertThat(service.deleteExpired()).isEqualTo(2);

        verify(users).deleteUserById(3L);
        verify(users).deleteUserById(4L);
    }

    @Test
    void nothingExpiredDeletesNothing() {
        when(users.findIdsByGuestUntilBefore(NOW_LOCAL)).thenReturn(List.of());

        assertThat(service.deleteExpired()).isZero();
        verify(users, never()).deleteUserById(anyLong());
    }
}
