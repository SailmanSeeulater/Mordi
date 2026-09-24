package com.mordi.backend.together;

import java.time.LocalDate;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Shared goals. Invite codes travel in request bodies, never in URLs, so they
 * stay out of access logs; the page link carries them after a # for the same
 * reason (see Join.jsx).
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TogetherController {

    private final TogetherService togetherService;
    private final MessageService messageService;

    public record CodeRequest(String code) {
    }

    public record MessageRequest(String body) {
    }

    // ── Invites ─────────────────────────────────────────────

    @PostMapping("/goals/{id}/invites")
    public ResponseEntity<TogetherService.InviteLink> createInvite(
            @AuthenticationPrincipal String email, @PathVariable Long id) {
        return ResponseEntity.ok(togetherService.createInvite(email, id));
    }

    @DeleteMapping("/goals/{id}/invites")
    public ResponseEntity<Void> revokeInvites(@AuthenticationPrincipal String email, @PathVariable Long id) {
        togetherService.revokeInvites(email, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/invites/preview")
    public ResponseEntity<TogetherService.InvitePreview> previewInvite(
            @AuthenticationPrincipal String email, @RequestBody CodeRequest request) {
        return ResponseEntity.ok(togetherService.preview(email, request.code()));
    }

    @PostMapping("/invites/accept")
    public ResponseEntity<Map<String, Long>> acceptInvite(
            @AuthenticationPrincipal String email, @RequestBody CodeRequest request) {
        return ResponseEntity.ok(Map.of("goalId", togetherService.accept(email, request.code())));
    }

    // ── Members ─────────────────────────────────────────────

    @GetMapping("/goals/{id}/together")
    public ResponseEntity<TogetherService.Week> week(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return ResponseEntity.ok(togetherService.week(email, id, week != null ? week : LocalDate.now()));
    }

    @DeleteMapping("/goals/{id}/membership")
    public ResponseEntity<Void> leave(@AuthenticationPrincipal String email, @PathVariable Long id) {
        togetherService.leave(email, id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/goals/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @AuthenticationPrincipal String email, @PathVariable Long id, @PathVariable Long userId) {
        togetherService.removeMember(email, id, userId);
        return ResponseEntity.noContent().build();
    }

    // ── Thread ──────────────────────────────────────────────

    @GetMapping("/goals/{id}/messages")
    public ResponseEntity<MessageService.MessagePage> messages(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestParam(required = false) Long before) {
        return ResponseEntity.ok(messageService.list(email, id, before));
    }

    @PostMapping("/goals/{id}/messages")
    public ResponseEntity<MessageService.MessageView> post(
            @AuthenticationPrincipal String email, @PathVariable Long id, @RequestBody MessageRequest request) {
        return ResponseEntity.ok(messageService.post(email, id, request.body()));
    }

    @DeleteMapping("/goals/{id}/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @AuthenticationPrincipal String email, @PathVariable Long id, @PathVariable Long messageId) {
        messageService.delete(email, id, messageId);
        return ResponseEntity.noContent().build();
    }
}
