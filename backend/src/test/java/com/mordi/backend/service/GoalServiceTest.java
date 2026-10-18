package com.mordi.backend.service;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoalServiceTest {

    private static final String ME = "sailor@mordi.com";

    @Mock
    private GoalRepository goalRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BehaviorRepository behaviorRepository;

    @Mock
    private GoalMemberRepository memberRepository;

    @Mock
    private GoalMessageRepository messageRepository;

    @Mock
    private CategoryRepository categoryRepository;

    private GoalService goalService;
    private User me;
    private User someoneElse;

    @BeforeEach
    void setUp() {
        goalService = new GoalService(goalRepository, userRepository, behaviorRepository, memberRepository, messageRepository, categoryRepository);
        me = user(ME);
        someoneElse = user("other@mordi.com");
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(String email) {
        User user = new User();
        user.setEmail(email);
        return user;
    }

    private Goal existingGoal(User owner) {
        Goal goal = new Goal();
        goal.setId(10L);
        goal.setUser(owner);
        goal.setTitle("Run");
        goal.setCategory("fitness");
        goal.setTargetPerWeek(4);
        return goal;
    }

    private GoalRequest request(Integer targetPerWeek) {
        GoalRequest request = new GoalRequest();
        request.setTitle("Run");
        request.setCategory("fitness");
        request.setTargetPerWeek(targetPerWeek);
        return request;
    }

    @Nested
    class Create {

        @Test
        void withoutTarget_defaultsToOncePerWeek() {
            assertThat(goalService.createGoal(ME, request(null)).getTargetPerWeek()).isEqualTo(1);
        }

        @Test
        void withValidTarget_keepsIt() {
            assertThat(goalService.createGoal(ME, request(4)).getTargetPerWeek()).isEqualTo(4);
        }

        @Test
        void withOutOfRangeTarget_throwsAndNeverSaves() {
            assertThatThrownBy(() -> goalService.createGoal(ME, request(8)))
                .hasMessageContaining("between 1 and 7");
            assertThatThrownBy(() -> goalService.createGoal(ME, request(0)))
                .hasMessageContaining("between 1 and 7");

            verify(goalRepository, never()).save(any());
        }
    }

    @Nested
    class Update {

        @Test
        void changesOnlyTheFieldsProvided() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(me)));

            GoalRequest patch = new GoalRequest();
            patch.setTitle("Run further");

            Goal updated = goalService.updateGoal(ME, 10L, patch);

            assertThat(updated.getTitle()).isEqualTo("Run further");
            assertThat(updated.getCategory()).isEqualTo("fitness");
            assertThat(updated.getTargetPerWeek()).isEqualTo(4);
        }

        @Test
        void clearsCategoryWhenBlank() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(me)));

            GoalRequest patch = new GoalRequest();
            patch.setCategory("  ");

            assertThat(goalService.updateGoal(ME, 10L, patch).getCategory()).isNull();
        }

        @Test
        void rejectsAnOutOfRangeTarget() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(me)));

            assertThatThrownBy(() -> goalService.updateGoal(ME, 10L, request(9)))
                .hasMessageContaining("between 1 and 7");

            verify(goalRepository, never()).save(any());
        }

        @Test
        void refusesAnotherUsersGoalAsNotFound() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(someoneElse)));

            assertThatThrownBy(() -> goalService.updateGoal(ME, 10L, request(3)))
                .isInstanceOf(GoalNotFoundException.class)
                .hasMessage("Goal not found");

            verify(goalRepository, never()).save(any());
        }

        @Test
        void refusesAnArchivedGoal() {
            Goal archived = existingGoal(me);
            archived.setActive(false);
            when(goalRepository.findById(10L)).thenReturn(Optional.of(archived));

            assertThatThrownBy(() -> goalService.updateGoal(ME, 10L, request(3)))
                .isInstanceOf(GoalNotFoundException.class);
        }
    }

    @Nested
    class Deactivate {

        @Test
        void archivesOwnGoal() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(me)));

            assertThat(goalService.deactivateGoal(ME, 10L).isActive()).isFalse();
        }

        @Test
        void refusesAnotherUsersGoalAsNotFound() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(someoneElse)));

            assertThatThrownBy(() -> goalService.deactivateGoal(ME, 10L))
                .isInstanceOf(GoalNotFoundException.class)
                .hasMessage("Goal not found");

            verify(goalRepository, never()).save(any());
        }

        @Test
        void refusesAMissingGoal() {
            when(goalRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> goalService.deactivateGoal(ME, 99L))
                .isInstanceOf(GoalNotFoundException.class);
        }
    }

    @Nested
    class Archive {

        @Test
        void archivingStampsTheGoalAndKeepsItActive() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(me)));

            Goal archived = goalService.archiveGoal(ME, 10L);

            assertThat(archived.getArchivedAt()).isNotNull();
            // Still active: its entries must keep resolving to it.
            assertThat(archived.isActive()).isTrue();
        }

        @Test
        void archivingTwiceKeepsTheFirstDate() {
            Goal goal = existingGoal(me);
            java.time.LocalDateTime first = java.time.LocalDateTime.of(2026, 1, 2, 3, 4);
            goal.setArchivedAt(first);
            when(goalRepository.findById(10L)).thenReturn(Optional.of(goal));

            assertThat(goalService.archiveGoal(ME, 10L).getArchivedAt()).isEqualTo(first);
        }

        @Test
        void restoringClearsTheDate() {
            Goal goal = existingGoal(me);
            goal.setArchivedAt(java.time.LocalDateTime.now());
            when(goalRepository.findById(10L)).thenReturn(Optional.of(goal));

            assertThat(goalService.restoreGoal(ME, 10L).getArchivedAt()).isNull();
        }

        @Test
        void refusesAnotherUsersGoalAsNotFound() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(someoneElse)));

            assertThatThrownBy(() -> goalService.archiveGoal(ME, 10L))
                .isInstanceOf(GoalNotFoundException.class);
            assertThatThrownBy(() -> goalService.restoreGoal(ME, 10L))
                .isInstanceOf(GoalNotFoundException.class);
            verify(goalRepository, never()).save(any());
        }

        @Test
        void historyCarriesEachGoalsTotals() {
            Goal logged = existingGoal(me);
            logged.setArchivedAt(java.time.LocalDateTime.now());
            Goal empty = existingGoal(me);
            empty.setId(11L);
            empty.setArchivedAt(java.time.LocalDateTime.now());
            when(goalRepository.findByUserAndActiveTrueAndArchivedAtIsNotNullOrderByArchivedAtDesc(me))
                .thenReturn(java.util.List.of(logged, empty));
            java.time.LocalDate first = java.time.LocalDate.of(2026, 3, 1);
            java.time.LocalDate last = java.time.LocalDate.of(2026, 6, 30);
            when(behaviorRepository.summarizeByGoal(eq(me), any()))
                .thenReturn(java.util.List.<Object[]>of(new Object[] {10L, 42L, 40L, first, last}));

            var history = goalService.getArchivedGoals(ME);

            assertThat(history).hasSize(2);
            assertThat(history.get(0).entries()).isEqualTo(42);
            assertThat(history.get(0).completed()).isEqualTo(40);
            assertThat(history.get(0).firstLog()).isEqualTo(first);
            assertThat(history.get(0).lastLog()).isEqualTo(last);
            // A goal archived before anything was logged still appears, at zero.
            assertThat(history.get(1).entries()).isZero();
            assertThat(history.get(1).firstLog()).isNull();
        }

        @Test
        void dashboardListExcludesArchivedGoals() {
            goalService.getActiveGoals(ME);

            verify(goalRepository).findByUserAndActiveTrueAndArchivedAtIsNull(me);
            verify(goalRepository, never()).findByUserAndActive(any(), anyBoolean());
        }
    }

    @Test
    void getActiveGoals_addsSharedGoalsIJoined_eachMarkedWithRoleHeadCountAndUnread() {
        someoneElse.setName("Alex Kim");
        Goal mine = existingGoal(me);
        Goal joined = existingGoal(someoneElse);
        joined.setId(20L);
        when(goalRepository.findByUserAndActiveTrueAndArchivedAtIsNull(me)).thenReturn(new java.util.ArrayList<>(java.util.List.of(mine)));
        when(memberRepository.findJoinedGoals(me)).thenReturn(java.util.List.of(joined));
        when(memberRepository.countByGoalIds(any())).thenReturn(java.util.List.<Object[]>of(new Object[] {20L, 3L}));
        when(messageRepository.countUnread(me)).thenReturn(java.util.List.<Object[]>of(new Object[] {20L, 2L}));

        java.util.List<Goal> goals = goalService.getActiveGoals(ME);

        assertThat(goals).containsExactly(mine, joined);
        assertThat(mine.getRole()).isEqualTo("owner");
        assertThat(mine.getMemberCount()).isEqualTo(1);
        assertThat(mine.getUnread()).isZero();
        assertThat(mine.getOwnerName()).isNull();
        assertThat(joined.getRole()).isEqualTo("member");
        assertThat(joined.getMemberCount()).isEqualTo(3);
        assertThat(joined.getUnread()).isEqualTo(2);
        assertThat(joined.getOwnerName()).isEqualTo("Alex Kim");
    }

    private Category category(Long id, User owner, String name, String icon) {
        Category category = new Category();
        category.setId(id);
        category.setUser(owner);
        category.setName(name);
        category.setIcon(icon);
        return category;
    }

    @Nested
    class IconsAndCategories {

        @Test
        void aGoalKeepsTheIconItWasGiven() {
            GoalRequest request = request(3);
            request.setIcon("book");

            assertThat(goalService.createGoal(ME, request).getIcon()).isEqualTo("book");
        }

        @Test
        void withoutAnIcon_aGoalFallsBackToItsCategory() {
            assertThat(goalService.createGoal(ME, request(3)).getIcon()).isNull();
        }

        @Test
        void refusesAnIconMordiCannotDraw() {
            GoalRequest request = request(3);
            request.setIcon("rocket");

            assertThatThrownBy(() -> goalService.createGoal(ME, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Pick one of the icons");
            verify(goalRepository, never()).save(any());
        }

        @Test
        void anEmptyIconGoesBackToTheCategorysAndAMissingOneIsLeftAlone() {
            Goal goal = existingGoal(me);
            goal.setIcon("book");
            when(goalRepository.findById(10L)).thenReturn(Optional.of(goal));

            GoalRequest untouched = new GoalRequest();
            untouched.setTitle("Run more");
            assertThat(goalService.updateGoal(ME, 10L, untouched).getIcon()).isEqualTo("book");

            GoalRequest cleared = new GoalRequest();
            cleared.setIcon("");
            assertThat(goalService.updateGoal(ME, 10L, cleared).getIcon()).isNull();
        }

        @Test
        void refusesAnUnknownIconOnEditToo() {
            when(goalRepository.findById(10L)).thenReturn(Optional.of(existingGoal(me)));
            GoalRequest patch = new GoalRequest();
            patch.setIcon("<svg>");

            assertThatThrownBy(() -> goalService.updateGoal(ME, 10L, patch))
                .hasMessage("Pick one of the icons");
            verify(goalRepository, never()).save(any());
        }

        @Test
        void acceptsABuiltInCategoryOrNone() {
            GoalRequest builtIn = request(3);
            builtIn.setCategory("sleep");
            assertThat(goalService.createGoal(ME, builtIn).getCategory()).isEqualTo("sleep");

            GoalRequest none = request(3);
            none.setCategory("");
            assertThat(goalService.createGoal(ME, none).getCategory()).isNull();
        }

        @Test
        void acceptsOneOfMyOwnCategories() {
            when(categoryRepository.findById(7L)).thenReturn(Optional.of(category(7L, me, "Reading", "book")));
            GoalRequest request = request(3);
            request.setCategory("custom:7");

            assertThat(goalService.createGoal(ME, request).getCategory()).isEqualTo("custom:7");
        }

        @Test
        void refusesSomeoneElsesCategoryLikeOneThatDoesNotExist() {
            when(categoryRepository.findById(7L)).thenReturn(Optional.of(category(7L, someoneElse, "Theirs", "book")));
            when(categoryRepository.findById(8L)).thenReturn(Optional.empty());

            for (String value : java.util.List.of("custom:7", "custom:8", "custom:x", "custom:", "running")) {
                GoalRequest request = request(3);
                request.setCategory(value);
                assertThatThrownBy(() -> goalService.createGoal(ME, request))
                    .as(value)
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("That category doesn’t exist");
            }
            verify(goalRepository, never()).save(any());
        }

        @Test
        void listedGoalsInACustomCategoryCarryItsNameAndIcon() {
            Goal mine = existingGoal(me);
            mine.setCategory("custom:7");
            Goal plain = existingGoal(me);
            plain.setId(11L);
            when(goalRepository.findByUserAndActiveTrueAndArchivedAtIsNull(me))
                .thenReturn(new java.util.ArrayList<>(java.util.List.of(mine, plain)));
            when(categoryRepository.findAllById(any()))
                .thenReturn(java.util.List.of(category(7L, me, "Reading", "book")));

            goalService.getActiveGoals(ME);

            assertThat(mine.getCategoryName()).isEqualTo("Reading");
            assertThat(mine.getCategoryIcon()).isEqualTo("book");
            assertThat(plain.getCategoryName()).isNull();
            assertThat(plain.getCategoryIcon()).isNull();
        }
    }

    @Test
    void editingArchivingOrDeleting_aSharedGoalIOnlyJoined_readsAsNotFound() {
        Goal joined = existingGoal(someoneElse);
        when(goalRepository.findById(10L)).thenReturn(Optional.of(joined));

        assertThatThrownBy(() -> goalService.archiveGoal(ME, 10L)).isInstanceOf(GoalNotFoundException.class);
        assertThatThrownBy(() -> goalService.deactivateGoal(ME, 10L)).isInstanceOf(GoalNotFoundException.class);
        verify(goalRepository, never()).save(any());
    }
}
