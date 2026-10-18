package com.mordi.backend.feeds;

import com.mordi.backend.dto.CalendarFeedRequest;
import com.mordi.backend.dto.CalendarFeedResponse;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/calendar-feeds")
@RequiredArgsConstructor
public class CalendarFeedController {

    private final CalendarFeedService service;

    /** Whether this server can connect Google Calendars at all: {enabled}. */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> config() {
        return ResponseEntity.ok(service.config());
    }

    @GetMapping
    public ResponseEntity<List<CalendarFeedResponse>> list(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(service.list(email));
    }

    /** Connects a secret address and syncs it at once; answers with the counts. */
    @PostMapping
    public ResponseEntity<CalendarFeedResponse> connect(
            @AuthenticationPrincipal String email,
            @RequestBody CalendarFeedRequest request) {
        return ResponseEntity.ok(service.connect(email, request));
    }

    /** Name and colour only. */
    @PatchMapping("/{id}")
    public ResponseEntity<CalendarFeedResponse> update(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestBody CalendarFeedRequest request) {
        return ResponseEntity.ok(service.update(email, id, request));
    }

    /** Sync now; at most once a minute per calendar. The body, if any, carries the browser's zone. */
    @PostMapping("/{id}/sync")
    public ResponseEntity<CalendarFeedResponse> sync(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestBody(required = false) CalendarFeedRequest request) {
        return ResponseEntity.ok(service.syncNow(email, id, request));
    }

    /** Disconnects; its events leave Mordi's calendar. Nothing changes in Google. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> disconnect(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        service.disconnect(email, id);
        return ResponseEntity.noContent().build();
    }
}
