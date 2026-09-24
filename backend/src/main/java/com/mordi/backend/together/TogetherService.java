package com.mordi.backend.together;

import com.mordi.backend.exception.GoalFullException;
import com.mordi.backend.exception.InviteNotFoundException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalInvite;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalInviteRepository;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.GoalAccess;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shared goals: inviting people in, who is in, and the week they have had.
 *
 * What crosses between people is deliberately small. Members see each
 * other's names and which days each marked the goal done; never the notes,
 * moods or places on anyone's entries, which stay with the person who wrote
 * them.
 */
@Service
@RequiredArgsConstructor
public class TogetherService {

    /** The owner included. Small on purpose: a goal, not a group chat. */
    public static final int MAX_MEMBERS = 8;
    static final Duration INVITE_TTL = Duration.ofDays(7);
    /** 256 bits, as for refresh tokens: not guessable. */
    private static final int CODE_BYTES = 32;

    private final UserRepository userRepository;
    private final GoalAccess goalAccess;
    private final GoalMemberRepository memberRepository;
    private final GoalInviteRepository inviteRepository;
    private final BehaviorRepository behaviorRepository;
    private final SecureRandom random = new SecureRandom();

    public record InviteLink(String code, Instant expiresAt) {
    }

    public record InvitePreview(String goalTitle, String ownerName, int memberCount, int targetPerWeek,
                                boolean alreadyIn, Long goalId) {
    }

    public record MemberWeek(Long id, String name, boolean you, boolean owner, List<Boolean> days, int done) {
    }

    public record Week(Long goalId, String title, int targetPerWeek, String role, LocalDate weekStart,
                       List<MemberWeek> members, int maxMembers) {
    }

    /**
     * A new invite link for a goal the person owns. One link is live at a
     * time: making a new one retires the last, so a link that went further
     * than intended is closed by simply making another.
     */
    @Transactional
    public InviteLink createInvite(String email, Long goalId) {
        User me = findUser(email);
        Goal goal = goalAccess.owned(me, goalId);
        Instant now = Instant.now();

        // The owner's own row, the first time the goal is shared, so the
        // owner has a place to keep their read position like everyone else.
        if (!memberRepository.existsByGoalAndUser(goal, me)) {
            GoalMember owner = new GoalMember();
            owner.setGoal(goal);
            owner.setUser(me);
            memberRepository.save(owner);
        }
        revokeLive(goal, now);

        byte[] bytes = new byte[CODE_BYTES];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        GoalInvite invite = new GoalInvite();
        invite.setGoal(goal);
        invite.setTokenHash(hash(code));
        invite.setCreatedBy(me);
        invite.setCreatedAt(now);
        invite.setExpiresAt(now.plus(INVITE_TTL));
        inviteRepository.save(invite);
        return new InviteLink(code, invite.getExpiresAt());
    }

    /** Closes every live link to the goal. People already in stay in. */
    @Transactional
    public void revokeInvites(String email, Long goalId) {
        Goal goal = goalAccess.owned(findUser(email), goalId);
        revokeLive(goal, Instant.now());
    }

    /** What an invite is for, before accepting it. The owner's first name only. */
    public InvitePreview preview(String email, String code) {
        User me = findUser(email);
        Goal goal = usableInvite(code).getGoal();
        return new InvitePreview(
            goal.getTitle(),
            firstName(goal.getUser().getName()),
            headCount(goal),
            goal.getTargetPerWeek(),
            isIn(goal, me),
            goal.getId());
    }

    /** Joins the goal. Accepting twice, or your own goal's link, is harmless. */
    @Transactional
    public Long accept(String email, String code) {
        User me = findUser(email);
        Goal goal = usableInvite(code).getGoal();
        if (isIn(goal, me)) {
            return goal.getId();
        }
        if (headCount(goal) >= MAX_MEMBERS) {
            throw new GoalFullException(MAX_MEMBERS);
        }
        GoalMember member = new GoalMember();
        member.setGoal(goal);
        member.setUser(me);
        memberRepository.save(member);
        return goal.getId();
    }

    /** Leaves a goal someone else owns. Your past entries stay yours. */
    @Transactional
    public void leave(String email, Long goalId) {
        User me = findUser(email);
        Goal goal = goalAccess.joined(me, goalId);
        if (GoalAccess.isOwner(goal, me)) {
            throw new IllegalArgumentException("You own this goal, so you can't leave it. Archive it instead.");
        }
        memberRepository.findByGoalAndUser(goal, me).ifPresent(memberRepository::delete);
    }

    /** The owner takes someone out. Their entries stay theirs. */
    @Transactional
    public void removeMember(String email, Long goalId, Long userId) {
        User me = findUser(email);
        Goal goal = goalAccess.owned(me, goalId);
        if (userId.equals(me.getId())) {
            throw new IllegalArgumentException("You own this goal, so you can't remove yourself.");
        }
        memberRepository.findByGoalOrderByJoinedAtAsc(goal).stream()
            .filter(member -> userId.equals(member.getUser().getId()))
            .findFirst()
            .ifPresent(memberRepository::delete);
    }

    /**
     * Everyone in the goal and the days each of them marked it done, for the
     * Monday-to-Sunday week holding the given day. Dates are each person's own
     * log dates, the calendar day they logged on where they were.
     */
    public Week week(String email, Long goalId, LocalDate anyDay) {
        User me = findUser(email);
        Goal goal = goalAccess.joined(me, goalId);
        LocalDate monday = anyDay.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        Map<Long, Set<LocalDate>> doneDays = new HashMap<>();
        for (Object[] row : behaviorRepository.completedDaysForGoal(goal.getId(), monday, monday.plusDays(6))) {
            doneDays.computeIfAbsent((Long) row[0], k -> new HashSet<>()).add((LocalDate) row[1]);
        }

        List<MemberWeek> members = new ArrayList<>();
        for (User person : people(goal)) {
            Set<LocalDate> done = doneDays.getOrDefault(person.getId(), Set.of());
            List<Boolean> days = new ArrayList<>(7);
            for (int i = 0; i < 7; i++) {
                days.add(done.contains(monday.plusDays(i)));
            }
            members.add(new MemberWeek(
                person.getId(),
                person.getName(),
                GoalAccess.sameUser(person, me),
                GoalAccess.isOwner(goal, person),
                days,
                done.size()));
        }
        return new Week(goal.getId(), goal.getTitle(), goal.getTargetPerWeek(),
            GoalAccess.isOwner(goal, me) ? "owner" : "member", monday, members, MAX_MEMBERS);
    }

    /** The owner first, then everyone else in the order they joined. */
    List<User> people(Goal goal) {
        List<User> people = new ArrayList<>();
        people.add(goal.getUser());
        for (GoalMember member : memberRepository.findByGoalOrderByJoinedAtAsc(goal)) {
            if (!GoalAccess.isOwner(goal, member.getUser())) {
                people.add(member.getUser());
            }
        }
        return people;
    }

    private boolean isIn(Goal goal, User user) {
        return GoalAccess.isOwner(goal, user) || memberRepository.existsByGoalAndUser(goal, user);
    }

    /** Everyone in it, the owner counted even before their own row exists. */
    private int headCount(Goal goal) {
        return (int) Math.max(1, memberRepository.countByGoal(goal));
    }

    /**
     * An invite that can still be used, for a goal that is still running.
     * Wrong, expired, revoked and ended all look the same from outside.
     */
    private GoalInvite usableInvite(String code) {
        if (code == null || code.isBlank() || code.length() > 64) {
            throw new InviteNotFoundException();
        }
        Instant now = Instant.now();
        return inviteRepository
            .findByTokenHash(hash(code.trim()))
            .filter(invite -> invite.usableAt(now))
            .filter(invite -> invite.getGoal().isActive() && invite.getGoal().getArchivedAt() == null)
            .orElseThrow(InviteNotFoundException::new);
    }

    private void revokeLive(Goal goal, Instant now) {
        for (GoalInvite invite : inviteRepository.findByGoalAndRevokedAtIsNull(goal)) {
            invite.setRevokedAt(now);
            inviteRepository.save(invite);
        }
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    static String firstName(String name) {
        if (name == null || name.isBlank()) {
            return "Someone";
        }
        return name.trim().split("\\s+")[0];
    }

    /** SHA-256 of the code; see RefreshTokenService.hash for why not a slow hash. */
    static String hash(String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
