package com.mordi.backend.service;

import com.mordi.backend.dto.ArchivedGoalResponse;
import com.mordi.backend.dto.GoalRequest;
import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.model.Category;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.CategoryRepository;
import com.mordi.backend.repository.GoalMemberRepository;
import com.mordi.backend.repository.GoalMessageRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;
    private final BehaviorRepository behaviorRepository;
    private final GoalMemberRepository memberRepository;
    private final GoalMessageRepository messageRepository;
    private final CategoryRepository categoryRepository;

    public Goal createGoal(String email, GoalRequest request) {
        User user = findUser(email);

        Goal goal = new Goal();
        goal.setUser(user);
        goal.setTitle(request.getTitle());
        goal.setDescription(request.getDescription());
        goal.setFrequency(request.getFrequency());
        goal.setCategory(request.getCategory() == null ? null : validCategory(user, request.getCategory()));
        goal.setIcon(request.getIcon() == null ? null : validIcon(request.getIcon()));
        goal.setTargetPerWeek(validTarget(request.getTargetPerWeek(), 1));
        goal.setPlannedDays(PlannedDays.valid(request.getPlannedDays()));
        matchTargetToPlannedDays(goal);
        goal.setPlaceName(blankToNull(request.getPlaceName()));

        return goalRepository.save(goal);
    }

    /**
     * The person's own current goals, then the shared ones they have joined,
     * each marked with how it looks to them: their role, how many people are
     * in it, and what they have not read in its thread.
     */
    public List<Goal> getActiveGoals(String email) {
        User user = findUser(email);
        List<Goal> goals = new ArrayList<>(goalRepository.findByUserAndActiveTrueAndArchivedAtIsNull(user));
        goals.forEach(goal -> goal.setRole("owner"));
        for (Goal joined : memberRepository.findJoinedGoals(user)) {
            joined.setRole("member");
            joined.setOwnerName(joined.getUser().getName());
            goals.add(joined);
        }
        if (goals.isEmpty()) {
            return goals;
        }

        Map<Long, Long> heads = new HashMap<>();
        for (Object[] row : memberRepository.countByGoalIds(goals.stream().map(Goal::getId).toList())) {
            heads.put((Long) row[0], ((Number) row[1]).longValue());
        }
        Map<Long, Long> unread = new HashMap<>();
        for (Object[] row : messageRepository.countUnread(user)) {
            unread.put((Long) row[0], ((Number) row[1]).longValue());
        }
        for (Goal goal : goals) {
            // A goal never shared has no member rows: it is just its owner.
            goal.setMemberCount((int) Math.max(1, heads.getOrDefault(goal.getId(), 1L)));
            goal.setUnread(unread.getOrDefault(goal.getId(), 0L));
        }
        Map<String, Category> custom = customCategories(goals.stream().map(Goal::getCategory).toList());
        for (Goal goal : goals) {
            Category category = custom.get(goal.getCategory());
            if (category != null) {
                goal.setCategoryName(category.getName());
                goal.setCategoryIcon(category.getIcon());
            }
        }
        return goals;
    }

    public Goal updateGoal(String email, Long goalId, GoalRequest request) {
        Goal goal = findOwnedGoal(email, goalId);

        if (request.getTitle() != null) {
            goal.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            goal.setDescription(request.getDescription());
        }
        if (request.getFrequency() != null) {
            goal.setFrequency(request.getFrequency());
        }
        // Category is clearable, so an explicitly empty value removes it.
        if (request.getCategory() != null) {
            goal.setCategory(validCategory(goal.getUser(), request.getCategory()));
        }
        // So is the icon: empty goes back to the category's.
        if (request.getIcon() != null) {
            goal.setIcon(validIcon(request.getIcon()));
        }
        goal.setTargetPerWeek(validTarget(request.getTargetPerWeek(), goal.getTargetPerWeek()));
        // Planned days are clearable too: 0 removes them, a missing value
        // leaves them alone. Either way, days that are set decide the target.
        if (request.getPlannedDays() != null) {
            goal.setPlannedDays(PlannedDays.valid(request.getPlannedDays()));
        }
        matchTargetToPlannedDays(goal);
        // Like category, the usual place is clearable: an explicitly empty
        // value removes it, a missing one leaves it alone.
        if (request.getPlaceName() != null) {
            goal.setPlaceName(blankToNull(request.getPlaceName()));
        }

        return goalRepository.save(goal);
    }

    public Goal deactivateGoal(String email, Long goalId) {
        Goal goal = findOwnedGoal(email, goalId);
        goal.setActive(false);
        return goalRepository.save(goal);
    }

    /** Off the dashboard and onto History. Archiving twice keeps the first date. */
    public Goal archiveGoal(String email, Long goalId) {
        Goal goal = findOwnedGoal(email, goalId);
        if (goal.getArchivedAt() == null) {
            goal.setArchivedAt(LocalDateTime.now());
        }
        return goalRepository.save(goal);
    }

    /** Back from History to the dashboard, entries and all. */
    public Goal restoreGoal(String email, Long goalId) {
        Goal goal = findOwnedGoal(email, goalId);
        goal.setArchivedAt(null);
        return goalRepository.save(goal);
    }

    /**
     * Archived goals, most recent first, each with what was logged against it.
     * One grouped query for all of them, not one per goal.
     */
    public List<ArchivedGoalResponse> getArchivedGoals(String email) {
        User user = findUser(email);
        List<Goal> goals = goalRepository.findByUserAndActiveTrueAndArchivedAtIsNotNullOrderByArchivedAtDesc(user);
        if (goals.isEmpty()) {
            return List.of();
        }
        Map<Long, Object[]> stats = new HashMap<>();
        for (Object[] row : behaviorRepository.summarizeByGoal(user, goals.stream().map(Goal::getId).toList())) {
            stats.put((Long) row[0], row);
        }
        Map<String, Category> custom = customCategories(goals.stream().map(Goal::getCategory).toList());
        return goals.stream().map(goal -> {
            Object[] row = stats.get(goal.getId());
            Category category = custom.get(goal.getCategory());
            return new ArchivedGoalResponse(
                goal.getId(),
                goal.getTitle(),
                goal.getCategory(),
                goal.getIcon(),
                category == null ? null : category.getName(),
                category == null ? null : category.getIcon(),
                goal.getTargetPerWeek(),
                goal.getPlannedDays(),
                goal.getPlaceName(),
                goal.getCreatedAt(),
                goal.getArchivedAt(),
                row == null ? 0 : ((Number) row[1]).longValue(),
                row == null || row[2] == null ? 0 : ((Number) row[2]).longValue(),
                row == null ? null : (LocalDate) row[3],
                row == null ? null : (LocalDate) row[4]);
        }).toList();
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Goals belonging to someone else are reported exactly like goals that do not
     * exist, so ids from other accounts cannot be probed.
     */
    private Goal findOwnedGoal(String email, Long goalId) {
        return goalRepository
            .findById(goalId)
            .filter(goal -> goal.isActive() && goal.getUser().getEmail().equals(email))
            .orElseThrow(GoalNotFoundException::new);
    }

    /**
     * The custom categories these goals point at, by the key they use. One
     * query for all of them. Not filtered by owner: a shared goal shows its
     * owner's category to everyone in it, and only the goal's owner could
     * have set it.
     */
    private Map<String, Category> customCategories(Collection<String> keys) {
        Set<Long> ids = new HashSet<>();
        for (String key : keys) {
            Long id = Icons.customCategoryId(key);
            if (id != null) {
                ids.add(id);
            }
        }
        Map<String, Category> byKey = new HashMap<>();
        if (ids.isEmpty()) {
            return byKey;
        }
        for (Category category : categoryRepository.findAllById(ids)) {
            byKey.put(category.getKey(), category);
        }
        return byKey;
    }

    /**
     * A built-in key, one of the owner's own categories as "custom:<id>", or
     * empty for none. Someone else's category is refused like a made-up one.
     */
    private String validCategory(User owner, String requested) {
        String value = requested.trim();
        if (value.isEmpty()) {
            return null;
        }
        if (Icons.BUILT_IN_CATEGORIES.contains(value)) {
            return value;
        }
        Long id = Icons.customCategoryId(value);
        boolean owned = id != null && categoryRepository
            .findById(id)
            .filter(category -> Objects.equals(category.getUser().getEmail(), owner.getEmail()))
            .isPresent();
        if (!owned) {
            throw new IllegalArgumentException("That category doesn’t exist");
        }
        return Icons.CUSTOM_PREFIX + id;
    }

    /** A key from the drawn set, or empty for "same as the category". */
    private String validIcon(String requested) {
        String value = requested.trim();
        if (value.isEmpty()) {
            return null;
        }
        if (!Icons.isKey(value)) {
            throw new IllegalArgumentException("Pick one of the icons");
        }
        return value;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * A goal planned for Monday, Wednesday and Friday is a three-times-a-week
     * goal: when days are picked, their count is the target, whatever target
     * the request carried. Setting it here rather than refusing a mismatch
     * means an older client that only sends a target (the Goals page's
     * suggestion) cannot leave the two disagreeing.
     */
    private void matchTargetToPlannedDays(Goal goal) {
        if (goal.getPlannedDays() != null) {
            goal.setTargetPerWeek(PlannedDays.count(goal.getPlannedDays()));
        }
    }

    private int validTarget(Integer requested, int fallback) {
        if (requested == null) {
            return fallback;
        }
        if (requested < 1 || requested > 7) {
            throw new IllegalArgumentException("targetPerWeek must be between 1 and 7");
        }
        return requested;
    }
}
