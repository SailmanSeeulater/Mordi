package com.mordi.backend.service;

import com.mordi.backend.exception.LinkExpiredException;
import com.mordi.backend.mail.Email;
import com.mordi.backend.mail.ResendMailer;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static com.mordi.backend.model.UserToken.Purpose.PASSWORD_RESET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordServiceTest {

    @Mock private UserRepository users;
    @Mock private PasswordEncoder encoder;
    @Mock private UserTokenService tokens;
    @Mock private RefreshTokenService sessions;
    @Mock private ResendMailer mailer;

    private PasswordService service;
    private User me;

    @BeforeEach
    void setUp() {
        // Trailing slash on purpose: the link must not come out with two.
        service = new PasswordService(users, encoder, tokens, sessions, mailer, "https://mordi.test/");
        me = new User();
        me.setId(1L);
        me.setEmail("me@mordi.com");
        me.setName("Me");
        me.setPassword("old-hash");
    }

    @Nested
    class RequestingAReset {

        @Test
        void anUnknownAddressSendsNothingAndDoesNotFail() {
            when(users.findByEmail("nobody@mordi.com")).thenReturn(Optional.empty());

            service.requestReset("nobody@mordi.com");

            verifyNoInteractions(tokens, mailer);
        }

        @Test
        void emailsALinkWithTheTokenAfterTheHash() {
            when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(me));
            when(tokens.issue(me, PASSWORD_RESET, PasswordService.RESET_TTL)).thenReturn("raw-token");

            service.requestReset("me@mordi.com");

            ArgumentCaptor<Email> sent = ArgumentCaptor.forClass(Email.class);
            verify(mailer).send(sent.capture());
            assertThat(sent.getValue().to()).isEqualTo("me@mordi.com");
            assertThat(sent.getValue().subject()).containsIgnoringCase("password");
            assertThat(sent.getValue().text()).contains("https://mordi.test/reset-password#raw-token");
            assertThat(sent.getValue().html()).contains("https://mordi.test/reset-password#raw-token");
        }

        @Test
        void theAddressIsMatchedRegardlessOfCaseAndSpacing() {
            when(users.findByEmail("me@mordi.com")).thenReturn(Optional.empty());

            service.requestReset("  Me@Mordi.COM ");

            verify(users).findByEmail("me@mordi.com");
        }
    }

    @Nested
    class Resetting {

        @Test
        void setsTheNewPasswordHashedAndSignsEveryDeviceOut() {
            when(tokens.consume("raw-token", PASSWORD_RESET)).thenReturn(me);
            when(encoder.encode("newpassword1")).thenReturn("new-hash");

            service.reset("raw-token", "newpassword1");

            assertThat(me.getPassword()).isEqualTo("new-hash");
            verify(users).save(me);
            verify(sessions).revokeAllFor(me);
        }

        @Test
        void aDeadLinkChangesNothing() {
            when(tokens.consume("stale", PASSWORD_RESET)).thenThrow(new LinkExpiredException());

            assertThatThrownBy(() -> service.reset("stale", "newpassword1"))
                .isInstanceOf(LinkExpiredException.class);

            verify(users, never()).save(any());
            verifyNoInteractions(sessions, encoder);
        }
    }

    @Nested
    class Changing {

        @Test
        void aWrongCurrentPasswordIsRefusedAndNothingChanges() {
            when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(me));
            when(encoder.matches("wrong", "old-hash")).thenReturn(false);

            assertThatThrownBy(() -> service.change("me@mordi.com", "wrong", "newpassword1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Current password");

            assertThat(me.getPassword()).isEqualTo("old-hash");
            verify(users, never()).save(any());
            verifyNoInteractions(sessions);
        }

        @Test
        void theRightCurrentPasswordSetsTheNewOneAndEndsEverySession() {
            when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(me));
            when(encoder.matches("old-password", "old-hash")).thenReturn(true);
            when(encoder.encode("newpassword1")).thenReturn("new-hash");

            User changed = service.change("me@mordi.com", "old-password", "newpassword1");

            assertThat(changed).isSameAs(me);
            assertThat(me.getPassword()).isEqualTo("new-hash");
            verify(users).save(me);
            verify(sessions).revokeAllFor(me);
        }
    }
}
