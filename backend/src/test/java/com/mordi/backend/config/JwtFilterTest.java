package com.mordi.backend.config;

import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** A real JwtUtil signing real tokens; only the user table is a stand-in. */
class JwtFilterTest {

    private final UserRepository users = mock(UserRepository.class);
    private JwtUtil jwt;
    private JwtFilter filter;

    @BeforeEach
    void setUp() {
        jwt = new JwtUtil();
        ReflectionTestUtils.setField(jwt, "secret", "a-test-secret-that-is-at-least-thirty-two-bytes-long");
        ReflectionTestUtils.setField(jwt, "expiration", 60_000L);
        filter = new JwtFilter(jwt, users);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private Authentication run(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/goals");
        if (token != null) {
            request.addHeader("Authorization", "Bearer " + token);
        }
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication();
    }

    private static User account(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        return user;
    }

    @Test
    void aTokenForAnAccountThatStillExistsSignsTheRequestIn() throws Exception {
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(account(7L, "me@mordi.com")));

        Authentication auth = run(jwt.generateToken("me@mordi.com", 7L));

        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isEqualTo("me@mordi.com");
    }

    @Test
    void aDeletedAccountsTokenIsRefusedBeforeItExpires() throws Exception {
        when(users.findByEmail("gone@mordi.com")).thenReturn(Optional.empty());

        assertThat(run(jwt.generateToken("gone@mordi.com", 7L))).isNull();
    }

    @Test
    void anOldTokenDoesNotOpenANewAccountOnTheSameAddress() throws Exception {
        // Deleted as id 7, signed up again as id 8.
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(account(8L, "me@mordi.com")));

        assertThat(run(jwt.generateToken("me@mordi.com", 7L))).isNull();
    }

    @Test
    void aTokenWithoutAnIdIsRefusedSoTheClientRefreshesIt() throws Exception {
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(account(7L, "me@mordi.com")));

        assertThat(run(jwt.generateToken("me@mordi.com", null))).isNull();
    }

    @Test
    void aForgedOrMissingTokenSignsNothingIn() throws Exception {
        assertThat(run("not.a.jwt")).isNull();
        assertThat(run(null)).isNull();
    }

    @Test
    void anAddressFromBeforeLowercasingStillMatches() throws Exception {
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(account(7L, "me@mordi.com")));

        Authentication auth = run(jwt.generateToken("Me@Mordi.com", 7L));

        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isEqualTo("me@mordi.com");
    }
}
