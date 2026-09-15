package com.mordi.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mordi.backend.dto.BehaviorRequest;
import com.mordi.backend.exception.GoalNotFoundException;
import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.BehaviorRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BehaviorServiceTest {

    private static final String ME = "me@mordi.com";

    @Mock
    private BehaviorRepository behaviorRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private GoalRepository goalRepository;

    private BehaviorService behaviorService;
    private User me;
    private User someoneElse;

    @BeforeEach
    void setUp() {
        behaviorService = new BehaviorService(behaviorRepository, userRepository, goalRepository);
        me = user(1L, ME, "Me");
        someoneElse = user(2L, "other@mordi.com", "Someone Else");
    }

    private static User user(Long id, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName(name);
        return user;
    }

    private static Goal goal(Long id, User owner) {
        Goal goal = new Goal();
        goal.setId(id);
        goal.setUser(owner);
        goal.setTitle("Run");
        return goal;
    }

    private static BehaviorRequest request(Long goalId) {
        BehaviorRequest request = new BehaviorRequest();
        request.setGoalId(goalId);
        request.setNote("Ran 3 miles");
        request.setCompleted(true);
        request.setMood("good");
        request.setLogDate(LocalDate.of(2026, 9, 14));
        return request;
    }

    @Test
    void logBehavior_againstOwnGoal_savesWithGoal() {
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(goalRepository.findById(10L)).thenReturn(Optional.of(goal(10L, me)));
        when(behaviorRepository.save(any(Behavior.class))).thenAnswer(inv -> inv.getArgument(0));

        Behavior saved = behaviorService.logBehavior(ME, request(10L));

        assertThat(saved.getGoal().getId()).isEqualTo(10L);
        assertThat(saved.getUser()).isSameAs(me);
    }

    @Test
    void logBehavior_againstAnotherUsersGoal_throwsNotFoundAndNeverSaves() {
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(goalRepository.findById(20L)).thenReturn(Optional.of(goal(20L, someoneElse)));

        assertThatThrownBy(() -> behaviorService.logBehavior(ME, request(20L)))
            .isInstanceOf(GoalNotFoundException.class)
            .hasMessage("Goal not found");

        verify(behaviorRepository, never()).save(any());
    }

    @Test
    void logBehavior_againstMissingGoal_throwsTheSameErrorAsAnotherUsersGoal() {
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(goalRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> behaviorService.logBehavior(ME, request(99L)))
            .isInstanceOf(GoalNotFoundException.class)
            .hasMessage("Goal not found");

        verify(behaviorRepository, never()).save(any());
    }

    @Test
    void logBehavior_againstOwnInactiveGoal_throwsAndNeverSaves() {
        Goal archived = goal(30L, me);
        archived.setActive(false);
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(goalRepository.findById(30L)).thenReturn(Optional.of(archived));

        assertThatThrownBy(() -> behaviorService.logBehavior(ME, request(30L)))
            .isInstanceOf(GoalNotFoundException.class);

        verify(behaviorRepository, never()).save(any());
    }

    @Test
    void logBehavior_withoutGoal_savesUnlinked() {
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(behaviorRepository.save(any(Behavior.class))).thenAnswer(inv -> inv.getArgument(0));

        Behavior saved = behaviorService.logBehavior(ME, request(null));

        assertThat(saved.getGoal()).isNull();
        verify(goalRepository, never()).findById(any());
    }

    @Test
    void serializedBehavior_neverIncludesOwnerDetails() throws Exception {
        Behavior behavior = new Behavior();
        behavior.setUser(me);
        behavior.setGoal(goal(10L, me));
        behavior.setNote("Ran 3 miles");
        behavior.setLogDate(LocalDate.of(2026, 9, 14));

        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(behavior);

        assertThat(json)
            .contains("\"title\":\"Run\"")
            .doesNotContain(ME)
            .doesNotContain("\"user\"");
    }
}
