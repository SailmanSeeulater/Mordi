package com.mordi.backend.together;

import com.mordi.backend.exception.MessageNotFoundException;
import com.mordi.backend.exception.TooManyMessagesException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.GoalMessage;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalMessageRepository;
import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.GoalAccess;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The thread inside a shared goal. The only messaging in Mordi: between
 * people who are in the same goal, never between arbitrary accounts, so there
 * is no directory to search and no way to message a stranger.
 */
@Service
@RequiredArgsConstructor
public class MessageService {

    static final int PAGE_SIZE = 50;
    public static final int MAX_LENGTH = 500;
    /** More than anyone types in a minute; stops a script, not a conversation. */
    static final int BURST = 10;
    static final Duration BURST_WINDOW = Duration.ofMinutes(1);

    private final UserRepository userRepository;
    private final GoalAccess goalAccess;
    private final GoalMemberRepository memberRepository;
    private final GoalMessageRepository messageRepository;
    private final ApplicationEventPublisher events;

    public record MessageView(Long id, Long authorId, String authorName, boolean you, String body, Instant createdAt) {
    }

    public record MessagePage(List<MessageView> messages, boolean more) {
    }

    /**
     * Up to a page of messages, oldest first. Without `before` it is the
     * newest page, and reading it marks the thread read.
     */
    @Transactional
    public MessagePage list(String email, Long goalId, Long before) {
        User me = findUser(email);
        Goal goal = goalAccess.joined(me, goalId);
        PageRequest page = PageRequest.of(0, PAGE_SIZE + 1);
        List<GoalMessage> rows = new ArrayList<>(before == null
            ? messageRepository.findByGoalOrderByIdDesc(goal, page)
            : messageRepository.findByGoalAndIdLessThanOrderByIdDesc(goal, before, page));

        boolean more = rows.size() > PAGE_SIZE;
        if (more) {
            rows = new ArrayList<>(rows.subList(0, PAGE_SIZE));
        }
        if (before == null && !rows.isEmpty()) {
            markRead(goal, me, rows.get(0).getId());
        }
        Collections.reverse(rows);
        return new MessagePage(rows.stream().map(m -> view(m, me)).toList(), more);
    }

    @Transactional
    public MessageView post(String email, Long goalId, String body) {
        User me = findUser(email);
        Goal goal = goalAccess.joined(me, goalId);

        String text = body == null ? "" : body.strip();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("Write something first.");
        }
        if (text.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Messages can be up to " + MAX_LENGTH + " characters.");
        }
        List<GoalMember> people = memberRepository.findByGoalOrderByJoinedAtAsc(goal);
        if (people.size() < 2) {
            throw new IllegalArgumentException("Invite someone to this goal before starting a thread.");
        }
        if (messageRepository.countByUserAndCreatedAtAfter(me, Instant.now().minus(BURST_WINDOW)) >= BURST) {
            throw new TooManyMessagesException();
        }

        GoalMessage message = new GoalMessage();
        message.setGoal(goal);
        message.setUser(me);
        message.setBody(text);
        GoalMessage saved = messageRepository.save(message);

        // Your own message is never unread to you.
        markRead(goal, me, saved.getId());

        List<Long> others = people.stream()
            .map(GoalMember::getUser)
            .filter(user -> !GoalAccess.sameUser(user, me))
            .map(User::getId)
            .toList();
        events.publishEvent(new MessagePosted(goal.getId(), goal.getTitle(), me.getName(), text, others));
        return view(saved, me);
    }

    /** Your own messages; the goal's owner may also remove anyone's. */
    @Transactional
    public void delete(String email, Long goalId, Long messageId) {
        User me = findUser(email);
        Goal goal = goalAccess.joined(me, goalId);
        GoalMessage message = messageRepository
            .findById(messageId)
            .filter(m -> m.getGoal().getId().equals(goal.getId()))
            .filter(m -> GoalAccess.sameUser(m.getUser(), me) || GoalAccess.isOwner(goal, me))
            .orElseThrow(MessageNotFoundException::new);
        messageRepository.delete(message);
    }

    private void markRead(Goal goal, User me, long newestId) {
        memberRepository.findByGoalAndUser(goal, me).ifPresent(member -> {
            if (newestId > member.getLastReadMessageId()) {
                member.setLastReadMessageId(newestId);
                memberRepository.save(member);
            }
        });
    }

    private static MessageView view(GoalMessage m, User me) {
        return new MessageView(
            m.getId(),
            m.getUser().getId(),
            m.getUser().getName(),
            GoalAccess.sameUser(m.getUser(), me),
            m.getBody(),
            m.getCreatedAt());
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
