package com.mordi.backend.dto;

import com.mordi.backend.model.Todo;
import java.util.List;

/**
 * One page of History's to-dos: done or removed, newest first, and whether
 * an older page follows.
 */
public record TodoHistoryPage(List<Todo> items, boolean hasMore) {
}
