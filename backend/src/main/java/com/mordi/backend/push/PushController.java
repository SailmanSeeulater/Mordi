package com.mordi.backend.push;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService service;

    /** Whether push is available here, the public key, and this person's settings. */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> config(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(service.config(email));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(
            @AuthenticationPrincipal String email,
            @RequestBody PushService.SubscribeRequest request) {
        service.subscribe(email, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, String> body) {
        service.unsubscribe(email, body.get("endpoint"));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/reminder")
    public ResponseEntity<Map<String, Object>> reminder(
            @AuthenticationPrincipal String email,
            @RequestBody PushService.ReminderRequest request) {
        return ResponseEntity.ok(service.setReminder(email, request));
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, Integer>> test(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(Map.of("sent", service.sendTest(email)));
    }
}
