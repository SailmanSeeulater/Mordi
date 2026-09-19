package com.mordi.backend.controller;

import com.mordi.backend.dto.ArchivedGoalResponse;
import com.mordi.backend.dto.GoalRequest;
import com.mordi.backend.model.Goal;
import com.mordi.backend.service.GoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    @PostMapping
    public ResponseEntity<Goal> createGoal(
            @AuthenticationPrincipal String email,
            @RequestBody GoalRequest request) {
        return ResponseEntity.ok(goalService.createGoal(email, request));
    }

    @GetMapping
    public ResponseEntity<List<Goal>> getGoals(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(goalService.getActiveGoals(email));
    }

    /** History: goals that were archived, with what each amounted to. */
    @GetMapping("/archived")
    public ResponseEntity<List<ArchivedGoalResponse>> getArchivedGoals(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(goalService.getArchivedGoals(email));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<Goal> archiveGoal(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        return ResponseEntity.ok(goalService.archiveGoal(email, id));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Goal> restoreGoal(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        return ResponseEntity.ok(goalService.restoreGoal(email, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Goal> updateGoal(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestBody GoalRequest request) {
        return ResponseEntity.ok(goalService.updateGoal(email, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Goal> deleteGoal(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        return ResponseEntity.ok(goalService.deactivateGoal(email, id));
    }
}
