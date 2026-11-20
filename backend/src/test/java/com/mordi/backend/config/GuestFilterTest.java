package com.mordi.backend.config;

import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.util.Optional;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GuestFilterTest {

    private static final String GUEST = "guest-1@guest.invalid";

    private final UserRepository users = mock(UserRepository.class);
    private final GuestFilter filter = new GuestFilter(users, 500);

    @BeforeEach
    void setUp() {
        User guest = new User();
        guest.setId(7L);
        when(users.findByEmail(GUEST)).thenReturn(Optional.of(guest));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void signedInAs(String email, boolean guest) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            email, null, guest ? List.of(GuestFilter.GUEST) : List.of()));
    }

    private record Outcome(MockHttpServletResponse response, boolean passed) {}

    private Outcome run(String method, String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        return new Outcome(response, chain.getRequest() != null);
    }

    @Test
    void aGuestCannotShareConnectOrRemind() throws Exception {
        signedInAs(GUEST, true);
        for (String[] route : new String[][] {
            {"POST", "/api/goals/12/invites"},
            {"POST", "/api/invites/accept"},
            {"POST", "/api/goals/12/messages"},
            {"POST", "/api/calendar-feeds"},
            {"POST", "/api/calendar-feeds/3/sync"},
            {"POST", "/api/push/subscribe"},
            {"PUT", "/api/push/reminder"},
            {"PUT", "/api/account/password"},
            {"POST", "/api/push/subscribe/"},
        }) {
            Outcome outcome = run(route[0], route[1]);
            assertThat(outcome.passed()).as(route[1]).isFalse();
            assertThat(outcome.response().getStatus()).as(route[1]).isEqualTo(403);
            assertThat(outcome.response().getContentAsString()).contains("\"guest\":\"blocked\"");
        }
    }

    @Test
    void aGuestCanStillReadThosePages() throws Exception {
        signedInAs(GUEST, true);
        assertThat(run("GET", "/api/calendar-feeds").passed()).isTrue();
        assertThat(run("GET", "/api/goals/12/together").passed()).isTrue();
        assertThat(run("GET", "/api/push/config").passed()).isTrue();
    }

    @Test
    void aSavedAccountIsNotHeldBack() throws Exception {
        signedInAs("ana@example.com", false);
        assertThat(run("POST", "/api/goals/12/invites").passed()).isTrue();
        assertThat(run("POST", "/api/goals").passed()).isTrue();
        verify(users, never()).countItems(anyLong());
    }

    @Test
    void aGuestMakesThingsUntilTheCap() throws Exception {
        signedInAs(GUEST, true);
        when(users.countItems(7L)).thenReturn(499L);
        assertThat(run("POST", "/api/behaviors").passed()).isTrue();

        when(users.countItems(7L)).thenReturn(500L);
        Outcome full = run("POST", "/api/todos");
        assertThat(full.passed()).isFalse();
        assertThat(full.response().getStatus()).isEqualTo(403);
        assertThat(full.response().getContentAsString()).contains("\"guest\":\"full\"");
    }

    @Test
    void editingAndDeletingAtTheCapStillWork() throws Exception {
        signedInAs(GUEST, true);
        assertThat(run("PUT", "/api/todos/4").passed()).isTrue();
        assertThat(run("DELETE", "/api/goals/4").passed()).isTrue();
        verify(users, never()).countItems(anyLong());
    }
}
