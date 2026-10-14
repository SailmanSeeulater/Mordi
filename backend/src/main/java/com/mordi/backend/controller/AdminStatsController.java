package com.mordi.backend.controller;

import com.mordi.backend.model.DailyStats;
import com.mordi.backend.service.EmailAddresses;
import com.mordi.backend.service.StatsService;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * How many people use Mordi and how often, for the person who runs it.
 *
 * Open only to the addresses in mordi.admin.emails (MORDI_ADMIN_EMAILS),
 * empty by default, so nobody. Everyone else is answered 404, not 403: a
 * refusal would say there is something here to refuse.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminStatsController {

    /** What the page gets: today as counted now, and the saved days. */
    public record UsageResponse(DailyStats today, List<DailyStats> days) {}

    private final StatsService statsService;
    private final Set<String> admins;

    public AdminStatsController(
            StatsService statsService,
            @Value("${mordi.admin.emails:}") String adminEmails) {
        this.statsService = statsService;
        this.admins = Arrays.stream(adminEmails.split(","))
            .map(EmailAddresses::normalize)
            .filter(address -> !address.isEmpty())
            .collect(Collectors.toUnmodifiableSet());
    }

    @GetMapping("/stats")
    public ResponseEntity<UsageResponse> stats(@AuthenticationPrincipal String email) {
        if (email == null || !admins.contains(EmailAddresses.normalize(email))) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(new UsageResponse(statsService.today(), statsService.recentDays()));
    }
}
