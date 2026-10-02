package com.mordi.backend.service;

import com.mordi.backend.exception.LinkExpiredException;
import com.mordi.backend.model.User;
import com.mordi.backend.model.UserToken;
import com.mordi.backend.repository.UserTokenRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static com.mordi.backend.model.UserToken.Purpose.PASSWORD_RESET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * One-time links, with a fixed clock so expiry is exercised without waiting
 * and an in-memory map standing in for the table.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserTokenServiceTest {

    private static final Instant T0 = Instant.parse("2026-10-02T09:00:00Z");
    private static final ZoneId UTC = ZoneId.of("UTC");
    private static final Duration TTL = Duration.ofMinutes(30);

    @Mock private UserTokenRepository repository;

    private User me;
    private Map<String, UserToken> table;

    @BeforeEach
    void setUp() {
        me = new User();
        me.setId(1L);
        me.setEmail("me@mordi.com");
        me.setName("Me");

        table = new HashMap<>();
        when(repository.save(any(UserToken.class))).thenAnswer(inv -> {
            UserToken token = inv.getArgument(0);
            table.put(token.getTokenHash(), token);
            return token;
        });
        when(repository.findByTokenHash(anyString()))
            .thenAnswer(inv -> Optional.ofNullable(table.get(inv.getArgument(0))));
    }

    private UserTokenService at(Instant instant) {
        return new UserTokenService(repository, Clock.fixed(instant, UTC));
    }

    @Test
    void storesAHashAndNeverTheRawToken() {
        String raw = at(T0).issue(me, PASSWORD_RESET, TTL);

        assertThat(raw).hasSizeGreaterThanOrEqualTo(40);
        assertThat(table).hasSize(1);
        UserToken stored = table.values().iterator().next();
        assertThat(stored.getTokenHash()).isEqualTo(Tokens.hash(raw)).isNotEqualTo(raw);
        assertThat(stored.getUser()).isSameAs(me);
        assertThat(stored.getPurpose()).isEqualTo(PASSWORD_RESET);
        assertThat(stored.getExpiresAt()).isEqualTo(LocalDateTime.ofInstant(T0, UTC).plus(TTL));
        assertThat(stored.isUsed()).isFalse();
    }

    @Test
    void retiresEarlierLinksOfTheSameKindSoOnlyTheLatestWorks() {
        at(T0).issue(me, PASSWORD_RESET, TTL);

        verify(repository).retireOutstanding(me, PASSWORD_RESET, LocalDateTime.ofInstant(T0, UTC));
    }

    @Test
    void consumeReturnsWhoseItWasAndMarksItUsed() {
        String raw = at(T0).issue(me, PASSWORD_RESET, TTL);

        User owner = at(T0.plus(Duration.ofMinutes(5))).consume(raw, PASSWORD_RESET);

        assertThat(owner).isSameAs(me);
        assertThat(table.get(Tokens.hash(raw)).isUsed()).isTrue();
    }

    @Test
    void aLinkWorksOnce() {
        String raw = at(T0).issue(me, PASSWORD_RESET, TTL);
        at(T0).consume(raw, PASSWORD_RESET);

        assertThatThrownBy(() -> at(T0).consume(raw, PASSWORD_RESET))
            .isInstanceOf(LinkExpiredException.class);
    }

    @Test
    void aLinkStillWorksJustBeforeItExpires() {
        String raw = at(T0).issue(me, PASSWORD_RESET, TTL);

        assertThat(at(T0.plus(TTL).minusSeconds(1)).consume(raw, PASSWORD_RESET)).isSameAs(me);
    }

    @Test
    void anExpiredLinkIsRefused() {
        String raw = at(T0).issue(me, PASSWORD_RESET, TTL);

        assertThatThrownBy(() -> at(T0.plus(TTL)).consume(raw, PASSWORD_RESET))
            .isInstanceOf(LinkExpiredException.class);
        assertThat(table.get(Tokens.hash(raw)).isUsed()).isFalse();
    }

    @Test
    void anUnknownOrBlankLinkIsRefusedTheSameWay() {
        assertThatThrownBy(() -> at(T0).consume("never-issued", PASSWORD_RESET))
            .isInstanceOf(LinkExpiredException.class);
        assertThatThrownBy(() -> at(T0).consume("", PASSWORD_RESET))
            .isInstanceOf(LinkExpiredException.class);
        assertThatThrownBy(() -> at(T0).consume(null, PASSWORD_RESET))
            .isInstanceOf(LinkExpiredException.class);
    }
}
