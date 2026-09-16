package com.mordi.backend.service;

import com.mordi.backend.dto.GoalRequest;
import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
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

    private GoalService goalService;
    private User me;
    private User someoneElse;

    @BeforeEach
    void setUp() {
        goalService = new GoalService(goalRepository, userRepository);
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
}
