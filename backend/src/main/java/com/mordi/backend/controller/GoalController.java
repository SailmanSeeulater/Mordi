package com.mordi.backend.controller;

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

    @DeleteMapping
    public ResponseEntity<Goal> deleteGoal(
                @AuthenticationPrincipal String email,
                @PathVariable Long id) {
            return ResponseEntity.ok(goalService.deactivateGoal(email, id));
        }
}
