package com.mordi.backend.service;

import com.mordi.backend.exception.InvalidRefreshTokenException;
import com.mordi.backend.model.RefreshToken;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.RefreshTokenRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RefreshTokenServiceTest {

    private static final String ME = "me@mordi.com";
    private static final Instant T0 = Instant.parse("2026-09-16T09:00:00Z");
    private static final ZoneId UTC = ZoneId.of("UTC");

    @Mock private RefreshTokenRepository repository;
    @Mock private UserRepository userRepository;

    private User me;
    /** An in-memory stand-in for the table, keyed by hash. */
    private Map<String, RefreshToken> table;

    @BeforeEach
    void setUp() {
        me = new User();
        me.setId(1L);
        me.setEmail(ME);
        me.setName("Me");

        table = new HashMap<>();
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> {
            RefreshToken token = inv.getArgument(0);
            table.put(token.getTokenHash(), token);
            return token;
        });
        when(repository.findByTokenHash(anyString()))
            .thenAnswer(inv -> Optional.ofNullable(table.get(inv.getArgument(0))));
    }

    private RefreshTokenService serviceAt(Instant instant) {
        return new RefreshTokenService(
            repository, userRepository, Duration.ofDays(30), Clock.fixed(instant, UTC));
    }

    @Nested
    class Issuing {

        @Test
        void storesAHashAndNeverTheRawToken() {
            String raw = serviceAt(T0).issueFor(ME);

            assertThat(table).hasSize(1);
            RefreshToken stored = table.values().iterator().next();
            assertThat(stored.getTokenHash()).isNotEqualTo(raw).hasSize(64);
            assertThat(stored.getTokenHash()).isEqualTo(RefreshTokenService.hash(raw));
        }

        @Test
        void expiresAfterTheConfiguredLifetime() {
            serviceAt(T0).issueFor(ME);

            RefreshToken stored = table.values().iterator().next();
            assertThat(stored.getExpiresAt())
                .isEqualTo(LocalDateTime.ofInstant(T0, UTC).plusDays(30));
        }

        @Test
        void everySignInStartsItsOwnFamily() {
            RefreshTokenService service = serviceAt(T0);
            service.issueFor(ME);
            service.issueFor(ME);

            assertThat(table.values().stream().map(RefreshToken::getFamilyId).distinct())
                .hasSize(2);
        }

        @Test
        void producesDifferentTokensEachTime() {
            RefreshTokenService service = serviceAt(T0);
            assertThat(service.issueFor(ME)).isNotEqualTo(service.issueFor(ME));
        }
    }

    @Nested
    class Rotating {

        @Test
        void swapsTheTokenForANewOneInTheSameFamily() {
            String first = serviceAt(T0).issueFor(ME);
            UUID family = table.get(RefreshTokenService.hash(first)).getFamilyId();

            RefreshTokenService.Rotation rotation = serviceAt(T0.plusSeconds(60)).rotate(first);

            assertThat(rotation.user()).isSameAs(me);
            assertThat(rotation.token()).isNotEqualTo(first);
            assertThat(table.get(RefreshTokenService.hash(first)).isRevoked()).isTrue();
            RefreshToken next = table.get(RefreshTokenService.hash(rotation.token()));
            assertThat(next.isRevoked()).isFalse();
            assertThat(next.getFamilyId()).isEqualTo(family);
        }

        @Test
        void aChainOfDailyRotationsKeepsWorking() {
            // The case the user reported: coming back the next day, and the day
            // after, without signing in again.
            String token = serviceAt(T0).issueFor(ME);
            for (int day = 1; day <= 5; day++) {
                token = serviceAt(T0.plus(Duration.ofDays(day))).rotate(token).token();
            }
            assertThat(table.get(RefreshTokenService.hash(token)).isRevoked()).isFalse();
        }

        @Test
        void refusesAnUnknownToken() {
            assertThatThrownBy(() -> serviceAt(T0).rotate("not-a-real-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);
        }

        @Test
        void refusesAMissingToken() {
            assertThatThrownBy(() -> serviceAt(T0).rotate(null))
                .isInstanceOf(InvalidRefreshTokenException.class);
            assertThatThrownBy(() -> serviceAt(T0).rotate("  "))
                .isInstanceOf(InvalidRefreshTokenException.class);
        }

        @Test
        void refusesAnExpiredTokenAndIssuesNothing() {
            String raw = serviceAt(T0).issueFor(ME);
            int before = table.size();

            assertThatThrownBy(() -> serviceAt(T0.plus(Duration.ofDays(31))).rotate(raw))
                .isInstanceOf(InvalidRefreshTokenException.class);
            assertThat(table).hasSize(before);
        }

        @Test
        void aTokenAtExactlyItsExpiryIsAlreadyExpired() {
            String raw = serviceAt(T0).issueFor(ME);

            assertThatThrownBy(() -> serviceAt(T0.plus(Duration.ofDays(30))).rotate(raw))
                .isInstanceOf(InvalidRefreshTokenException.class);
        }
    }

    @Nested
    class ReuseDetection {

        @Test
        void presentingAnAlreadyRotatedTokenRevokesTheWholeFamily() {
            String stolen = serviceAt(T0).issueFor(ME);
            UUID family = table.get(RefreshTokenService.hash(stolen)).getFamilyId();

            // The owner rotates first, legitimately.
            serviceAt(T0.plusSeconds(60)).rotate(stolen);

            // Then the copy is replayed.
            assertThatThrownBy(() -> serviceAt(T0.plusSeconds(120)).rotate(stolen))
                .isInstanceOf(InvalidRefreshTokenException.class);
            verify(repository).revokeFamily(eq(family), any(LocalDateTime.class));
        }

        @Test
        void anUnknownTokenDoesNotRevokeAnything() {
            assertThatThrownBy(() -> serviceAt(T0).rotate("never-issued"))
                .isInstanceOf(InvalidRefreshTokenException.class);
            verify(repository, never()).revokeFamily(any(), any());
        }

        @Test
        void anExpiredButUnusedTokenIsNotTreatedAsTheft() {
            String raw = serviceAt(T0).issueFor(ME);

            assertThatThrownBy(() -> serviceAt(T0.plus(Duration.ofDays(40))).rotate(raw))
                .isInstanceOf(InvalidRefreshTokenException.class);
            verify(repository, never()).revokeFamily(any(), any());
        }
    }

    @Nested
    class SigningOut {

        @Test
        void revokesTheToken() {
            String raw = serviceAt(T0).issueFor(ME);

            serviceAt(T0.plusSeconds(10)).revoke(raw);

            assertThat(table.get(RefreshTokenService.hash(raw)).isRevoked()).isTrue();
        }

        @Test
        void aSignedOutTokenCannotBeUsedToRefresh() {
            String raw = serviceAt(T0).issueFor(ME);
            serviceAt(T0.plusSeconds(10)).revoke(raw);

            assertThatThrownBy(() -> serviceAt(T0.plusSeconds(20)).rotate(raw))
                .isInstanceOf(InvalidRefreshTokenException.class);
        }

        @Test
        void isQuietAboutAnUnknownOrMissingToken() {
            RefreshTokenService service = serviceAt(T0);
            service.revoke("never-issued");
            service.revoke(null);
            service.revoke("");
            verify(repository, never()).save(any());
        }

        @Test
        void signingOutTwiceDoesNotMoveTheRevocationTime() {
            String raw = serviceAt(T0).issueFor(ME);
            serviceAt(T0.plusSeconds(10)).revoke(raw);
            LocalDateTime first = table.get(RefreshTokenService.hash(raw)).getRevokedAt();

            serviceAt(T0.plusSeconds(99)).revoke(raw);

            assertThat(table.get(RefreshTokenService.hash(raw)).getRevokedAt()).isEqualTo(first);
        }
    }
}
