package com.mordi.backend.together;

import com.mordi.backend.model.User;
import com.mordi.backend.push.PushService;
import com.mordi.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Tells the other people in a shared goal about a new message, by Web Push.
 *
 * After the message is committed, so nobody is notified of one that was
 * rolled back; and on a worker thread, because each push is a request to the
 * browser vendor's server and the sender should not wait on them.
 */
@Component
@RequiredArgsConstructor
public class TogetherNotifier {

    private static final Logger log = LoggerFactory.getLogger(TogetherNotifier.class);
    /** Enough to read on a lock screen; the thread has the rest. */
    static final int PREVIEW_LENGTH = 140;

    private final PushService pushService;
    private final UserRepository userRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessagePosted(MessagePosted event) {
        String title = event.authorName() + " · " + event.goalTitle();
        String body = preview(event.body());
        String url = "/together/" + event.goalId();
        // One notification per goal on each device, replaced as new ones come.
        String tag = "mordi-goal-" + event.goalId();
        for (User user : userRepository.findAllById(event.recipientIds())) {
            try {
                pushService.notify(user, title, body, url, tag);
            } catch (RuntimeException e) {
                log.warn("Couldn't notify a member of goal {}: {}", event.goalId(), e.getMessage());
            }
        }
    }

    static String preview(String body) {
        return body.length() <= PREVIEW_LENGTH
            ? body
            : body.substring(0, PREVIEW_LENGTH - 1).stripTrailing() + "…";
    }
}
