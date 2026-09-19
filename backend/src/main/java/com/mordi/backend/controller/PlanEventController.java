package com.mordi.backend.controller;

import com.mordi.backend.dto.PlanEventRequest;
import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.service.PlanEventService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class PlanEventController {

    private final PlanEventService service;

    /** Events overlapping start..end, both inclusive, as YYYY-MM-DD. */
    @GetMapping
    public ResponseEntity<List<PlanEvent>> getEvents(
            @AuthenticationPrincipal String email,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return ResponseEntity.ok(service.getEvents(email, start, end));
    }

    @PostMapping
    public ResponseEntity<PlanEvent> createEvent(
            @AuthenticationPrincipal String email,
            @RequestBody PlanEventRequest request) {
        return ResponseEntity.ok(service.createEvent(email, request));
    }

    /** Bulk create from a calendar file; answers with imported and skipped counts. */
    @PostMapping("/import")
    public ResponseEntity<Map<String, Integer>> importEvents(
            @AuthenticationPrincipal String email,
            @RequestBody List<PlanEventRequest> requests) {
        return ResponseEntity.ok(service.importEvents(email, requests));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlanEvent> updateEvent(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestBody PlanEventRequest request) {
        return ResponseEntity.ok(service.updateEvent(email, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        service.deleteEvent(email, id);
        return ResponseEntity.noContent().build();
    }
}
