package com.mordi.backend.controller;

import com.mordi.backend.dto.BehaviorRequest;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.service.BehaviorService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/behaviors")
@RequiredArgsConstructor
public class BehaviorController {

    private final BehaviorService behaviorService;

    @PostMapping
    public ResponseEntity<Behavior> logBehavior(
            @AuthenticationPrincipal String email,
            @RequestBody BehaviorRequest request) {
                return ResponseEntity.ok(behaviorService.logBehavior(email, request));
    }

    /** Undo: removes one of the person's own entries. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBehavior(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        behaviorService.deleteBehavior(email, id);
        return ResponseEntity.noContent().build();
    }

    /** Every named place logged from, with visit counts and a map position. */
    @GetMapping("/places")
    public ResponseEntity<List<com.mordi.backend.dto.PlaceSummary>> getPlaces(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(behaviorService.getPlaces(email));
    }

    @GetMapping("/today")
    public ResponseEntity<List<Behavior>> getTodayBehaviors(
            @AuthenticationPrincipal String email) {
                return ResponseEntity.ok(behaviorService.getTodayBehaviors(email));
    }


    @GetMapping("/range")
    public ResponseEntity<List<Behavior>> getBehaviorsByRange(
            @AuthenticationPrincipal String email,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
                return ResponseEntity.ok(behaviorService.getBehaviorsByDateRange(email, start, end));
    }
}
