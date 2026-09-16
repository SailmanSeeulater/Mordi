package com.mordi.backend.service;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.Report;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.ReportRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The weekly report.
 *
 * It answers "did the week go the way it was meant to", which means measuring
 * entries against the target each goal was given rather than counting how many
 * of the entries that were written down got ticked. A week with one entry,
 * ticked, is not a 100% week if four were planned.
 *
 * Weeks are Monday to Sunday, the same week the dashboard draws, and a report
 * is keyed to its week: generating one for a week that already has a report
 * rewrites that report instead of adding a second one.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final BehaviorRepository behaviorRepository;
    private final GoalRepository goalRepository;

    /** The report for the week containing today. */
    public Report generateWeeklyReport(String email) {
        return generateWeeklyReport(email, LocalDate.now());
    }

    /** The report for the week containing {@code anyDayInWeek}. */
    public Report generateWeeklyReport(String email, LocalDate anyDayInWeek) {
        User user = findUser(email);

        LocalDate weekStart = anyDayInWeek.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        List<Behavior> behaviors =
            behaviorRepository.findByUserAndLogDateBetween(user, weekStart, weekEnd);
        List<Goal> goals = goalRepository.findByUserAndActive(user, true);

        int totalEntries = behaviors.size();
        int completedEntries = (int) behaviors.stream().filter(Behavior::isCompleted).count();

        // A goal counts one day at most, however many times it was logged that
        // day: the target is "three days a week", not "three entries".
        Map<Long, Set<LocalDate>> daysByGoal = new HashMap<>();
        for (Behavior behavior : behaviors) {
            if (behavior.isCompleted() && behavior.getGoal() != null) {
                daysByGoal
                    .computeIfAbsent(behavior.getGoal().getId(), id -> new HashSet<>())
                    .add(behavior.getLogDate());
            }
        }

        int planned = 0;
        int achieved = 0;
        int onTrack = 0;
        for (Goal goal : goals) {
            int target = Math.max(goal.getTargetPerWeek(), 1);
            int done = daysByGoal.getOrDefault(goal.getId(), Set.of()).size();
            planned += target;
            achieved += Math.min(done, target);
            if (done >= target) {
                onTrack++;
            }
        }

        double completionRate = planned > 0 ? (double) achieved / planned * 100 : 0;
        String mostCommonMood = mostCommonMood(behaviors);

        Report report = reportRepository
            .findByUserAndWeekStart(user, weekStart)
            .orElseGet(Report::new);
        report.setUser(user);
        report.setWeekStart(weekStart);
        report.setWeekEnd(weekEnd);
        report.setTotalBehaviors(totalEntries);
        report.setCompletedBehaviors(completedEntries);
        report.setPlannedEntries(planned);
        report.setAchievedEntries(achieved);
        report.setGoalsTotal(goals.size());
        report.setGoalsOnTrack(onTrack);
        report.setCompletionRate(completionRate);
        report.setMostCommonMood(mostCommonMood);
        report.setSummary(summarise(planned, achieved, onTrack, goals.size(), totalEntries,
            mostCommonMood, completionRate));

        return reportRepository.save(report);
    }

    public List<Report> getAllReports(String email) {
        return reportRepository.findByUserOrderByWeekStartDesc(findUser(email));
    }

    private String mostCommonMood(List<Behavior> behaviors) {
        return behaviors.stream()
            .filter(behavior -> behavior.getMood() != null)
            .collect(Collectors.groupingBy(Behavior::getMood, Collectors.counting()))
            .entrySet()
            .stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse(null);
    }

    /**
     * Plain prose, written for someone reading their own week back. No
     * exclamation marks and no encouragement: the numbers are the point.
     */
    private String summarise(
        int planned,
        int achieved,
        int onTrack,
        int goalCount,
        int entries,
        String mood,
        double rate
    ) {
        if (goalCount == 0) {
            return entries == 0
                ? "No goals and nothing logged this week."
                : "No goals set this week, but " + entries + " " + plural(entries, "entry", "entries")
                    + " logged.";
        }

        StringBuilder text = new StringBuilder();
        text.append(achieved)
            .append(" of ")
            .append(planned)
            .append(" planned ")
            .append(plural(planned, "entry", "entries"))
            .append(" (")
            .append(String.format("%.0f", rate))
            .append("%), across ")
            .append(goalCount)
            .append(" ")
            .append(plural(goalCount, "goal", "goals"))
            .append(". ");

        if (onTrack == goalCount) {
            text.append("Every goal hit its target.");
        } else if (onTrack == 0) {
            text.append("No goal reached its target.");
        } else {
            text.append(onTrack)
                .append(" of ")
                .append(goalCount)
                .append(" reached target.");
        }

        if (mood != null) {
            text.append(" Mood was most often ").append(mood).append(".");
        }
        return text.toString();
    }

    private String plural(int count, String one, String many) {
        return count == 1 ? one : many;
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
