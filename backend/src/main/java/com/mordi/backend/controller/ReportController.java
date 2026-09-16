package com.mordi.backend.controller;

import com.mordi.backend.model.Report;
import com.mordi.backend.service.ReportService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * Writes the report for a week. {@code week} may be any date inside the
     * week to report on and defaults to today, so the caller does not have to
     * work out which Monday it wants.
     */
    @PostMapping("/generate")
    public ResponseEntity<Report> generateReport(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return ResponseEntity.ok(
            week == null
                ? reportService.generateWeeklyReport(email)
                : reportService.generateWeeklyReport(email, week));
    }

    @GetMapping
    public ResponseEntity<List<Report>> getAllReports(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(reportService.getAllReports(email));
    }
}
