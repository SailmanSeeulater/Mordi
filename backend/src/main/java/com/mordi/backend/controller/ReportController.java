package com.mordi.backend.controller;

import com.mordi.backend.model.Report;
import com.mordi.backend.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @PostMapping("/generate")
    public ResponseEntity<Report> generateReport(
            @AuthenticationPrincipal String email) {
                return ResponseEntity.ok(reportService.generateWeeklyReport(email));
    }

    @GetMapping
    public ResponseEntity<List<Report>> getAllReports(
            @AuthenticationPrincipal String email) {
                return ResponseEntity.ok(reportService.getAllReports(email));
    }
}
