package com.mordi.backend.service;

import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock private UserRepository users;
    @Mock private GoalRepository goals;
    @Mock private GoalMemberRepository members;
    @Mock private PasswordEncoder encoder;
    @Mock private ApplicationEventPublisher events;

    private AccountService service;
    private User me;

    @BeforeEach
    void setUp() {
        service = new AccountService(users, goals, members, encoder, events);
        me = person(1L, "me@mordi.com", "Me");
        me.setPassword("hash");
    }

    private static User person(Long id, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName(name);
        return user;
    }

    private static Goal goal(Long id, User owner) {
        Goal goal = new Goal();
        goal.setId(id);
        goal.setUser(owner);
        goal.setTitle("Goal " + id);
        return goal;
    }

    private static GoalMember member(Goal goal, User user) {
        GoalMember m = new GoalMember();
        m.setGoal(goal);
        m.setUser(user);
        return m;
    }

    private void signedInWithRightPassword() {
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(me));
        when(encoder.matches("right", "hash")).thenReturn(true);
    }

    @Test
    void aWrongPasswordDeletesNothing() {
        when(users.findByEmail("me@mordi.com")).thenReturn(Optional.of(me));
        when(encoder.matches("wrong", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.delete("me@mordi.com", "wrong"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Password");

        verify(users, never()).deleteUserById(anyLong());
        verifyNoInteractions(goals, members, events);
    }

    @Test
    void anAccountThatIsAlreadyGoneIsNotSignedIn() {
        when(users.findByEmail("ghost@mordi.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete("ghost@mordi.com", "anything"))
            .isInstanceOf(InvalidCredentialsException.class);
        verify(users, never()).deleteUserById(anyLong());
    }

    @Test
    void deletesTheAccountAndAnnouncesItAfterwards() {
        signedInWithRightPassword();
        when(members.findOthersInGoalsOwnedBy(me)).thenReturn(List.of());

        service.delete("me@mordi.com", "right");

        verify(users).deleteUserById(1L);
        ArgumentCaptor<Object> event = ArgumentCaptor.forClass(Object.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue()).isEqualTo(new AccountService.AccountDeleted("me@mordi.com", "Me"));
        verify(goals, never()).save(any());
    }

    @Test
    void aSharedGoalPassesToWhoeverJoinedFirstBeforeTheAccountGoes() {
        signedInWithRightPassword();
        User sam = person(2L, "sam@mordi.com", "Sam");
        User jo = person(3L, "jo@mordi.com", "Jo");
        Goal run = goal(10L, me);
        // Longest-standing first, as the query orders them.
        when(members.findOthersInGoalsOwnedBy(me)).thenReturn(List.of(member(run, sam), member(run, jo)));

        service.delete("me@mordi.com", "right");

        assertThat(run.getUser()).isSameAs(sam);
        var order = inOrder(goals, users);
        order.verify(goals, times(1)).save(run);
        order.verify(users).deleteUserById(1L);
    }

    @Test
    void eachSharedGoalHasItsOwnHeir() {
        signedInWithRightPassword();
        User sam = person(2L, "sam@mordi.com", "Sam");
        User jo = person(3L, "jo@mordi.com", "Jo");
        Goal run = goal(10L, me);
        Goal read = goal(11L, me);
        when(members.findOthersInGoalsOwnedBy(me))
            .thenReturn(List.of(member(run, sam), member(run, jo), member(read, jo)));

        service.delete("me@mordi.com", "right");

        assertThat(run.getUser()).isSameAs(sam);
        assertThat(read.getUser()).isSameAs(jo);
        verify(goals, times(2)).save(any(Goal.class));
    }
}
