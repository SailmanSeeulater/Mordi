package com.mordi.backend.together;

import com.mordi.backend.exception.GoalFullException;
import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.exception.InviteNotFoundException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalInvite;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalInviteRepository;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.GoalAccess;
import java.time.Instant;
import java.time.LocalDate;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TogetherServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private GoalRepository goalRepository;
    @Mock private GoalMemberRepository memberRepository;
    @Mock private GoalInviteRepository inviteRepository;
    @Mock private BehaviorRepository behaviorRepository;

    private TogetherService service;
    private User owner;
    private User friend;
    private User stranger;
    private Goal goal;

    @BeforeEach
    void setUp() {
        service = new TogetherService(userRepository, new GoalAccess(goalRepository, memberRepository),
            memberRepository, inviteRepository, behaviorRepository);
        owner = user(1L, "owner@mordi.com", "Sam Rivera");
        friend = user(2L, "friend@mordi.com", "Alex");
        stranger = user(3L, "stranger@mordi.com", "Stranger");
        goal = new Goal();
        goal.setId(10L);
        goal.setUser(owner);
        goal.setTitle("Morning run");
        goal.setTargetPerWeek(4);
        when(goalRepository.findById(10L)).thenReturn(Optional.of(goal));
        when(inviteRepository.save(any(GoalInvite.class))).thenAnswer(inv -> inv.getArgument(0));
        when(memberRepository.save(any(GoalMember.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private User user(Long id, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName(name);
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        return user;
    }

    private GoalMember member(User user) {
        GoalMember member = new GoalMember();
        member.setGoal(goal);
        member.setUser(user);
        return member;
    }

    private GoalInvite invite(String code, Instant expiresAt, Instant revokedAt) {
        GoalInvite invite = new GoalInvite();
        invite.setGoal(goal);
        invite.setTokenHash(TogetherService.hash(code));
        invite.setExpiresAt(expiresAt);
        invite.setRevokedAt(revokedAt);
        when(inviteRepository.findByTokenHash(TogetherService.hash(code))).thenReturn(Optional.of(invite));
        return invite;
    }

    // ── Invites ─────────────────────────────────────────────

    @Test
    void createInvite_onAGoalIDoNotOwn_readsAsNotFound() {
        when(memberRepository.existsByGoalAndUser(goal, friend)).thenReturn(true);

        // Even a member can't invite; only the owner decides who is in.
        assertThatThrownBy(() -> service.createInvite("friend@mordi.com", 10L))
            .isInstanceOf(GoalNotFoundException.class);
        verify(inviteRepository, never()).save(any());
    }

    @Test
    void createInvite_storesOnlyTheHash_addsTheOwner_andRetiresTheLastLink() {
        GoalInvite old = invite("old-code", Instant.now().plusSeconds(3600), null);
        when(inviteRepository.findByGoalAndRevokedAtIsNull(goal)).thenReturn(List.of(old));

        TogetherService.InviteLink link = service.createInvite("owner@mordi.com", 10L);

        assertThat(link.code()).hasSizeGreaterThanOrEqualTo(43);
        ArgumentCaptor<GoalInvite> saved = ArgumentCaptor.forClass(GoalInvite.class);
        verify(inviteRepository, atLeastOnce()).save(saved.capture());
        GoalInvite created = saved.getAllValues().get(saved.getAllValues().size() - 1);
        assertThat(created.getTokenHash()).isEqualTo(TogetherService.hash(link.code())).isNotEqualTo(link.code());
        assertThat(created.getExpiresAt()).isAfter(Instant.now().plus(TogetherService.INVITE_TTL).minusSeconds(60));
        assertThat(old.getRevokedAt()).isNotNull();
        ArgumentCaptor<GoalMember> ownerRow = ArgumentCaptor.forClass(GoalMember.class);
        verify(memberRepository).save(ownerRow.capture());
        assertThat(ownerRow.getValue().getUser()).isSameAs(owner);
    }

    @Test
    void accept_joinsTheGoal() {
        invite("good", Instant.now().plusSeconds(3600), null);
        when(memberRepository.countByGoal(goal)).thenReturn(1L);

        assertThat(service.accept("friend@mordi.com", "good")).isEqualTo(10L);

        ArgumentCaptor<GoalMember> joined = ArgumentCaptor.forClass(GoalMember.class);
        verify(memberRepository).save(joined.capture());
        assertThat(joined.getValue().getUser()).isSameAs(friend);
        assertThat(joined.getValue().getGoal()).isSameAs(goal);
    }

    @Test
    void accept_expiredRevokedOrWrongCodes_allReadTheSame() {
        invite("expired", Instant.now().minusSeconds(1), null);
        invite("revoked", Instant.now().plusSeconds(3600), Instant.now().minusSeconds(5));

        for (String code : List.of("expired", "revoked", "never-issued", "")) {
            assertThatThrownBy(() -> service.accept("friend@mordi.com", code))
                .isInstanceOf(InviteNotFoundException.class)
                .hasMessage("This invite link has expired or isn't valid");
        }
        verify(memberRepository, never()).save(any());
    }

    @Test
    void accept_onAnArchivedGoal_readsAsExpired() {
        invite("good", Instant.now().plusSeconds(3600), null);
        goal.setArchivedAt(java.time.LocalDateTime.now());

        assertThatThrownBy(() -> service.accept("friend@mordi.com", "good"))
            .isInstanceOf(InviteNotFoundException.class);
    }

    @Test
    void accept_whenTheGoalIsFull_isRefused() {
        invite("good", Instant.now().plusSeconds(3600), null);
        when(memberRepository.countByGoal(goal)).thenReturn((long) TogetherService.MAX_MEMBERS);

        assertThatThrownBy(() -> service.accept("friend@mordi.com", "good"))
            .isInstanceOf(GoalFullException.class);
        verify(memberRepository, never()).save(any());
    }

    @Test
    void accept_myOwnGoalsLink_orTwice_changesNothing() {
        invite("good", Instant.now().plusSeconds(3600), null);
        when(memberRepository.existsByGoalAndUser(goal, friend)).thenReturn(true);

        assertThat(service.accept("owner@mordi.com", "good")).isEqualTo(10L);
        assertThat(service.accept("friend@mordi.com", "good")).isEqualTo(10L);
        verify(memberRepository, never()).save(any());
    }

    @Test
    void preview_showsTheOwnersFirstNameOnly() {
        invite("good", Instant.now().plusSeconds(3600), null);
        when(memberRepository.countByGoal(goal)).thenReturn(3L);

        TogetherService.InvitePreview preview = service.preview("stranger@mordi.com", "good");

        assertThat(preview.ownerName()).isEqualTo("Sam");
        assertThat(preview.memberCount()).isEqualTo(3);
        assertThat(preview.alreadyIn()).isFalse();
    }

    // ── Membership ──────────────────────────────────────────

    @Test
    void week_forSomeoneNotInTheGoal_readsAsNotFound() {
        assertThatThrownBy(() -> service.week("stranger@mordi.com", 10L, LocalDate.of(2026, 9, 23)))
            .isInstanceOf(GoalNotFoundException.class);
        verify(behaviorRepository, never()).completedDaysForGoal(any(), any(), any());
    }

    @Test
    void week_showsEachCurrentMembersDoneDays_andNobodyWhoLeft() {
        when(memberRepository.existsByGoalAndUser(goal, friend)).thenReturn(true);
        when(memberRepository.findByGoalOrderByJoinedAtAsc(goal)).thenReturn(List.of(member(owner), member(friend)));
        LocalDate monday = LocalDate.of(2026, 9, 21);
        when(behaviorRepository.completedDaysForGoal(10L, monday, monday.plusDays(6))).thenReturn(List.of(
            new Object[] {1L, monday},
            new Object[] {2L, monday},
            new Object[] {2L, monday.plusDays(2)},
            // Someone who has since left: not shown.
            new Object[] {3L, monday.plusDays(1)}));

        // Any day of the week gives that week.
        TogetherService.Week week = service.week("friend@mordi.com", 10L, monday.plusDays(3));

        assertThat(week.weekStart()).isEqualTo(monday);
        assertThat(week.role()).isEqualTo("member");
        assertThat(week.members()).extracting(TogetherService.MemberWeek::name).containsExactly("Sam Rivera", "Alex");
        TogetherService.MemberWeek alex = week.members().get(1);
        assertThat(alex.you()).isTrue();
        assertThat(alex.done()).isEqualTo(2);
        assertThat(alex.days()).containsExactly(true, false, true, false, false, false, false);
        assertThat(week.members().get(0).owner()).isTrue();
    }

    @Test
    void leave_asTheOwner_isRefused() {
        assertThatThrownBy(() -> service.leave("owner@mordi.com", 10L))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void leave_asAMember_removesOnlyMyRow() {
        GoalMember mine = member(friend);
        when(memberRepository.existsByGoalAndUser(goal, friend)).thenReturn(true);
        when(memberRepository.findByGoalAndUser(goal, friend)).thenReturn(Optional.of(mine));

        service.leave("friend@mordi.com", 10L);

        verify(memberRepository).delete(mine);
    }

    @Test
    void removeMember_byAnyoneButTheOwner_readsAsNotFound() {
        when(memberRepository.existsByGoalAndUser(goal, friend)).thenReturn(true);

        assertThatThrownBy(() -> service.removeMember("friend@mordi.com", 10L, 1L))
            .isInstanceOf(GoalNotFoundException.class);
        verify(memberRepository, never()).delete(any());
    }

    @Test
    void removeMember_byTheOwner_takesThemOut() {
        GoalMember theirs = member(friend);
        when(memberRepository.findByGoalOrderByJoinedAtAsc(goal)).thenReturn(List.of(member(owner), theirs));

        service.removeMember("owner@mordi.com", 10L, 2L);

        verify(memberRepository).delete(theirs);
    }
}
