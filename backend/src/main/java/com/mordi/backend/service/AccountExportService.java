package com.mordi.backend.service;

import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.CalendarFeed;
import com.mordi.backend.model.Category;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.GoalMessage;
import com.mordi.backend.model.Location;
import com.mordi.backend.model.Note;
import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.Report;
import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.CalendarFeedRepository;
import com.mordi.backend.repository.CategoryRepository;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalMessageRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.LocationRepository;
import com.mordi.backend.repository.NoteRepository;
import com.mordi.backend.repository.PlanEventRepository;
import com.mordi.backend.repository.PushSubscriptionRepository;
import com.mordi.backend.repository.ReportRepository;
import com.mordi.backend.repository.TodoRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Everything Mordi keeps about one person, in one download.
 *
 * Built on the server so nothing is left out for want of an endpoint: goals
 * (archived and removed ones too), entries, places, categories, notes, every
 * to-do including cleared ones, calendar events, weekly reports, shared goals
 * joined and the messages written in them. Left out on purpose: the password
 * hash, session and push keys, and a connected calendar's secret address.
 * Other people's entries and messages in a shared goal are theirs, not this
 * person's, so they stay out too.
 */
@Service
@RequiredArgsConstructor
public class AccountExportService {

    private final UserRepository users;
    private final GoalRepository goals;
    private final BehaviorRepository behaviors;
    private final LocationRepository locations;
    private final CategoryRepository categories;
    private final NoteRepository notes;
    private final TodoRepository todos;
    private final PlanEventRepository events;
    private final ReportRepository reports;
    private final GoalMemberRepository members;
    private final GoalMessageRepository messages;
    private final CalendarFeedRepository feeds;
    private final PushSubscriptionRepository pushSubscriptions;

    public record AccountExport(
        Instant exportedAt,
        Account account,
        List<GoalRow> goals,
        List<EntryRow> entries,
        List<PlaceRow> places,
        List<CategoryRow> categories,
        List<NoteRow> notes,
        List<TodoRow> todos,
        List<EventRow> events,
        List<ReportRow> weeklyReports,
        List<SharedGoalRow> sharedGoals,
        List<MessageRow> messages,
        List<CalendarRow> connectedCalendars,
        long devicesWithReminders) {}

    public record Account(
        String name, String email, LocalDateTime createdAt, String timeZone,
        Short reminderHour, String termsVersion, LocalDateTime termsAcceptedAt) {}

    public record GoalRow(
        Long id, String title, String description, String frequency, String category,
        String icon, int targetPerWeek, List<String> plannedDays, String placeName,
        boolean removed, LocalDateTime archivedAt, LocalDateTime createdAt) {}

    public record EntryRow(
        Long id, Long goalId, String goalTitle, LocalDate logDate, Instant loggedAt,
        boolean completed, String mood, String note, Integer durationSeconds,
        String placeName, Double latitude, Double longitude, LocalDateTime createdAt) {}

    public record PlaceRow(String placeName, Double latitude, Double longitude, LocalDateTime recordedAt) {}

    public record CategoryRow(String name, String icon, LocalDateTime createdAt) {}

    public record NoteRow(String title, String body, boolean pinned, LocalDateTime createdAt, LocalDateTime updatedAt) {}

    public record TodoRow(String text, boolean done, LocalDateTime createdAt, Instant completedAt) {}

    public record EventRow(
        String title, String notes, LocalDateTime startsAt, LocalDateTime endsAt, boolean allDay,
        String color, String placeName, String outcome, boolean fromConnectedCalendar) {}

    public record ReportRow(
        LocalDate weekStart, LocalDate weekEnd, Integer totalEntries, Integer completedEntries,
        Double completionRate, String mostCommonMood, Integer plannedEntries, Integer achievedEntries,
        Integer goalsOnTrack, Integer goalsTotal, String summary) {}

    public record SharedGoalRow(String goalTitle, boolean yours, Instant joinedAt) {}

    public record MessageRow(String goalTitle, String body, Instant createdAt) {}

    public record CalendarRow(String name, String color, int eventCount, LocalDateTime lastSyncedAt, String lastError) {}

    @Transactional(readOnly = true)
    public AccountExport export(String email) {
        User user = users
            .findByEmail(email)
            .orElseThrow(() -> new InvalidCredentialsException("Not signed in"));

        return new AccountExport(
            Instant.now(),
            new Account(
                user.getName(), user.getEmail(), user.getCreatedAt(), user.getTimeZone(),
                user.getReminderHour(), user.getTermsVersion(), user.getTermsAcceptedAt()),
            goals.findByUserOrderByIdAsc(user).stream().map(AccountExportService::goal).toList(),
            behaviors.findByUserOrderByLogDateAscIdAsc(user).stream().map(AccountExportService::entry).toList(),
            locations.findByUserOrderByRecordedAtDesc(user).stream()
                .map(l -> new PlaceRow(l.getPlaceName(), l.getLatitude(), l.getLongitude(), l.getRecordedAt()))
                .toList(),
            categories.findByUserOrderByNameAsc(user).stream()
                .map(c -> new CategoryRow(c.getName(), c.getIcon(), c.getCreatedAt()))
                .toList(),
            notes.findByUserOrderByPinnedDescUpdatedAtDesc(user).stream()
                .map(n -> new NoteRow(n.getTitle(), n.getBody(), n.isPinned(), n.getCreatedAt(), n.getUpdatedAt()))
                .toList(),
            todos.findByUserOrderByCreatedAtAsc(user).stream()
                .map(t -> new TodoRow(t.getText(), t.isDone(), t.getCreatedAt(), t.getCompletedAt()))
                .toList(),
            events.findByUserOrderByStartsAtAsc(user).stream().map(AccountExportService::event).toList(),
            reports.findByUserOrderByWeekStartDesc(user).stream().map(AccountExportService::report).toList(),
            members.findByUserOrderByJoinedAtAsc(user).stream().map(m -> shared(m, user)).toList(),
            messages.findByUserOrderByIdAsc(user).stream()
                .map(m -> new MessageRow(m.getGoal().getTitle(), m.getBody(), m.getCreatedAt()))
                .toList(),
            feeds.findByUserOrderByIdAsc(user).stream().map(AccountExportService::calendar).toList(),
            pushSubscriptions.countByUser(user));
    }

    private static GoalRow goal(Goal g) {
        return new GoalRow(
            g.getId(), g.getTitle(), g.getDescription(), g.getFrequency(), g.getCategory(), g.getIcon(),
            g.getTargetPerWeek(), dayNames(g.getPlannedDays()), g.getPlaceName(), !g.isActive(),
            g.getArchivedAt(), g.getCreatedAt());
    }

    private static EntryRow entry(Behavior b) {
        Goal goal = b.getGoal();
        return new EntryRow(
            b.getId(), goal == null ? null : goal.getId(), goal == null ? null : goal.getTitle(),
            b.getLogDate(), b.getLoggedAt(), b.isCompleted(), b.getMood(), b.getNote(),
            b.getDurationSeconds(), b.getPlaceName(), b.getLatitude(), b.getLongitude(), b.getCreatedAt());
    }

    private static EventRow event(PlanEvent e) {
        return new EventRow(
            e.getTitle(), e.getNotes(), e.getStartsAt(), e.getEndsAt(), e.isAllDay(), e.getColor(),
            e.getPlaceName(), e.getOutcome(), e.getFeedId() != null);
    }

    private static ReportRow report(Report r) {
        return new ReportRow(
            r.getWeekStart(), r.getWeekEnd(), r.getTotalBehaviors(), r.getCompletedBehaviors(),
            r.getCompletionRate(), r.getMostCommonMood(), r.getPlannedEntries(), r.getAchievedEntries(),
            r.getGoalsOnTrack(), r.getGoalsTotal(), r.getSummary());
    }

    private static SharedGoalRow shared(GoalMember m, User user) {
        Goal goal = m.getGoal();
        return new SharedGoalRow(goal.getTitle(), goal.getUser().getId().equals(user.getId()), m.getJoinedAt());
    }

    private static CalendarRow calendar(CalendarFeed f) {
        return new CalendarRow(f.getName(), f.getColor(), f.getEventCount(), f.getLastSyncedAt(), f.getLastError());
    }

    /** "MONDAY", "WEDNESDAY"… rather than the stored bit mask; empty for none. */
    static List<String> dayNames(Short mask) {
        List<String> days = new ArrayList<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            if (PlannedDays.includes(mask, day)) {
                days.add(day.name());
            }
        }
        return days;
    }
}
