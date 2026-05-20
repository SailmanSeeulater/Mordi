package com.mordi.backend.service;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Report;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.ReportRepository;
import com.mordi.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final BehaviorRepository behaviorRepository;

    public Report generateWeeklyReport(String email) {
        User user = userRepository.findByEmail(email)
                        .orElseThrow(() -> new RuntimeException("User not found"));

        LocalDate weekEnd = LocalDate.now();
        LocalDate weekStart = weekEnd.minusDays(7);

        List<Behavior> behaviors = behaviorRepository
                        .findByUserAndLogDateBetween(user, weekStart, weekEnd);

        int total = behaviors.size();
        int completed = (int) behaviors.stream()
                        .filter(Behavior::isCompleted)
                        .count();

        double completionRate = total > 0 ? (double) completed / total * 100 : 0;

        String mostCommonMood = behaviors.stream()
                        .filter(b -> b.getMood() != null)
                        .collect(Collectors.groupingBy(Behavior::getMood, Collectors.counting()))
                        .entrySet().stream()
                        .max(Map.Entry.comparingByValue())
                        .map(Map.Entry::getKey)
                        .orElse("No mood data");

        String summary = "Week of " + weekStart + " to " + weekEnd +
                        ": You logged " + total + " behaviors, completed " + completed +
                        " (" + String.format("%.1f", completionRate) + "% completion rate). " +
                        "Most common mood: " + mostCommonMood + ".";

        Report report = new Report();
        report.setUser(user);
        report.setWeekStart(weekStart);
        report.setWeekEnd(weekEnd);
        report.setTotalBehaviors(total);
        report.setCompletedBehaviors(completed);
        report.setCompletionRate(completionRate);
        report.setMostCommonMood(mostCommonMood);
        report.setSummary(summary);

        return reportRepository.save(report);
    }

    public List<Report> getAllReports(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return reportRepository.findByUserOrderByWeekStartDesc(user);
    }
}
