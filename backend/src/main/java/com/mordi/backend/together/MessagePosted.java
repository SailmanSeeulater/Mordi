package com.mordi.backend.together;

import java.util.List;

/** Published once a message is saved; see TogetherNotifier. */
public record MessagePosted(Long goalId, String goalTitle, String authorName, String body, List<Long> recipientIds) {
}
