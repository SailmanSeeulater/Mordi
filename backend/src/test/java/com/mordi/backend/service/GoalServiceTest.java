package com.mordi.backend.service;

import com.mordi.backend.dto.GoalRequest;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoalServiceTest {

    @Mock
    private GoalRepository goalRepository;

    @Mock
    private UserRepository userRepository;

    private GoalService goalService;

    @BeforeEach
    void setUp() {
        goalService = new GoalService(goalRepository, userRepository);
        User user = new User();
        user.setEmail("sailor@mordi.com");
        when(userRepository.findByEmail("sailor@mordi.com")).thenReturn(Optional.of(user));
    }

    private GoalRequest request(Integer targetPerWeek) {
        GoalRequest request = new GoalRequest();
        request.setTitle("Run");
        request.setCategory("fitness");
        request.setTargetPerWeek(targetPerWeek);
        return request;
    }

    @Test
    void createGoal_withoutTarget_defaultsToOncePerWeek() {
        when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));

        Goal goal = goalService.createGoal("sailor@mordi.com", request(null));

        assertThat(goal.getTargetPerWeek()).isEqualTo(1);
    }

    @Test
    void createGoal_withValidTarget_keepsIt() {
        when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));

        Goal goal = goalService.createGoal("sailor@mordi.com", request(4));

        assertThat(goal.getTargetPerWeek()).isEqualTo(4);
    }

    @Test
    void createGoal_withOutOfRangeTarget_throwsAndNeverSaves() {
        assertThatThrownBy(() -> goalService.createGoal("sailor@mordi.com", request(8)))
            .hasMessageContaining("between 1 and 7");
        assertThatThrownBy(() -> goalService.createGoal("sailor@mordi.com", request(0)))
            .hasMessageContaining("between 1 and 7");

        verify(goalRepository, never()).save(any());
    }
}
