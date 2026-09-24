package com.mordi.backend.together;

import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.exception.MessageNotFoundException;
import com.mordi.backend.exception.TooManyMessagesException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.GoalMessage;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalMessageRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.GoalAccess;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MessageServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private GoalRepository goalRepository;
    @Mock private GoalMemberRepository memberRepository;
    @Mock private GoalMessageRepository messageRepository;
    @Mock private ApplicationEventPublisher events;

    private MessageService service;
    private User owner;
    private User friend;
    private User third;
    private Goal goal;
    private GoalMember friendRow;

    @BeforeEach
    void setUp() {
        service = new MessageService(userRepository, new GoalAccess(goalRepository, memberRepository),
            memberRepository, messageRepository, events);
        owner = user(1L, "owner@mordi.com", "Sam");
        friend = user(2L, "friend@mordi.com", "Alex");
        third = user(3L, "third@mordi.com", "Jo");
        user(4L, "stranger@mordi.com", "Stranger");
        goal = new Goal();
        goal.setId(10L);
        goal.setUser(owner);
        goal.setTitle("Morning run");
        when(goalRepository.findById(10L)).thenReturn(Optional.of(goal));
        when(memberRepository.existsByGoalAndUser(goal, friend)).thenReturn(true);
        when(memberRepository.existsByGoalAndUser(goal, third)).thenReturn(true);
        friendRow = row(friend);
        when(memberRepository.findByGoalAndUser(goal, friend)).thenReturn(Optional.of(friendRow));
        when(memberRepository.findByGoalOrderByJoinedAtAsc(goal)).thenReturn(List.of(row(owner), friendRow, row(third)));
        when(messageRepository.save(any(GoalMessage.class))).thenAnswer(inv -> {
            GoalMessage m = inv.getArgument(0);
            m.setId(77L);
            return m;
        });
    }

    private User user(Long id, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName(name);
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        return user;
    }

    private GoalMember row(User user) {
        GoalMember member = new GoalMember();
        member.setGoal(goal);
        member.setUser(user);
        return member;
    }

    private GoalMessage message(Long id, User author) {
        GoalMessage m = new GoalMessage();
        m.setId(id);
        m.setGoal(goal);
        m.setUser(author);
        m.setBody("hi");
        return m;
    }

    @Test
    void post_bySomeoneNotInTheGoal_readsAsNotFound() {
        assertThatThrownBy(() -> service.post("stranger@mordi.com", 10L, "hello"))
            .isInstanceOf(GoalNotFoundException.class);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void post_emptyOrTooLong_isRejected() {
        assertThatThrownBy(() -> service.post("friend@mordi.com", 10L, "   "))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.post("friend@mordi.com", 10L, "x".repeat(MessageService.MAX_LENGTH + 1)))
            .isInstanceOf(IllegalArgumentException.class);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void post_inAGoalNobodyElseHasJoined_isRejected() {
        when(memberRepository.findByGoalOrderByJoinedAtAsc(goal)).thenReturn(List.of());

        assertThatThrownBy(() -> service.post("owner@mordi.com", 10L, "hello"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void post_fasterThanAnyoneTypes_isThrottled() {
        when(messageRepository.countByUserAndCreatedAtAfter(eq(friend), any())).thenReturn((long) MessageService.BURST);

        assertThatThrownBy(() -> service.post("friend@mordi.com", 10L, "hello"))
            .isInstanceOf(TooManyMessagesException.class);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void post_savesTrimmed_marksItReadForMe_andNotifiesEveryoneElse() {
        MessageService.MessageView view = service.post("friend@mordi.com", 10L, "  Ran 5k!  ");

        assertThat(view.body()).isEqualTo("Ran 5k!");
        assertThat(view.you()).isTrue();
        assertThat(friendRow.getLastReadMessageId()).isEqualTo(77L);
        ArgumentCaptor<MessagePosted> event = ArgumentCaptor.forClass(MessagePosted.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue().recipientIds()).containsExactly(1L, 3L);
        assertThat(event.getValue().authorName()).isEqualTo("Alex");
    }

    @Test
    void list_theNewestPage_marksTheThreadRead() {
        when(messageRepository.findByGoalOrderByIdDesc(eq(goal), any()))
            .thenReturn(List.of(message(9L, owner), message(8L, third)));

        MessageService.MessagePage page = service.list("friend@mordi.com", 10L, null);

        // Oldest first for reading.
        assertThat(page.messages()).extracting(MessageService.MessageView::id).containsExactly(8L, 9L);
        assertThat(page.more()).isFalse();
        assertThat(friendRow.getLastReadMessageId()).isEqualTo(9L);
    }

    @Test
    void list_anOlderPage_leavesTheReadMarkAlone() {
        friendRow.setLastReadMessageId(50L);
        when(messageRepository.findByGoalAndIdLessThanOrderByIdDesc(eq(goal), eq(9L), any()))
            .thenReturn(List.of(message(5L, owner)));

        service.list("friend@mordi.com", 10L, 9L);

        assertThat(friendRow.getLastReadMessageId()).isEqualTo(50L);
    }

    @Test
    void delete_someoneElsesMessage_asAMember_readsAsNotFound() {
        when(messageRepository.findById(5L)).thenReturn(Optional.of(message(5L, third)));

        assertThatThrownBy(() -> service.delete("friend@mordi.com", 10L, 5L))
            .isInstanceOf(MessageNotFoundException.class);
        verify(messageRepository, never()).delete(any());
    }

    @Test
    void delete_theOwnerMayRemoveAnyMessageInTheirGoal() {
        GoalMessage theirs = message(5L, third);
        when(messageRepository.findById(5L)).thenReturn(Optional.of(theirs));

        service.delete("owner@mordi.com", 10L, 5L);

        verify(messageRepository).delete(theirs);
    }

    @Test
    void delete_aMessageFromAnotherGoal_readsAsNotFound() {
        Goal other = new Goal();
        other.setId(11L);
        GoalMessage elsewhere = message(6L, friend);
        elsewhere.setGoal(other);
        when(messageRepository.findById(6L)).thenReturn(Optional.of(elsewhere));

        assertThatThrownBy(() -> service.delete("friend@mordi.com", 10L, 6L))
            .isInstanceOf(MessageNotFoundException.class);
    }

    @Test
    void notifierPreview_cutsLongMessagesForTheLockScreen() {
        assertThat(TogetherNotifier.preview("short")).isEqualTo("short");
        String cut = TogetherNotifier.preview("word ".repeat(60));
        assertThat(cut).hasSizeLessThanOrEqualTo(TogetherNotifier.PREVIEW_LENGTH).endsWith("…");
        verify(messageRepository, never()).findById(anyLong());
    }
}
