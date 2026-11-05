package com.mordi.backend.service;

import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.PreferencesService.Preferences;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PreferencesServiceTest {

    private static final String ME = "me@mordi.com";

    @Mock private UserRepository users;

    private PreferencesService service;
    private User me;

    @BeforeEach
    void setUp() {
        service = new PreferencesService(users);
        me = new User();
        me.setEmail(ME);
        when(users.findByEmail(ME)).thenReturn(Optional.of(me));
    }

    @Test
    void anAccountStartsItsWeekOnMonday() {
        assertThat(service.get(ME).weekStart()).isEqualTo("monday");
    }

    @Test
    void savesTheWeekStart() {
        when(users.save(me)).thenReturn(me);

        assertThat(service.update(ME, new Preferences("sunday")).weekStart()).isEqualTo("sunday");
        assertThat(me.getWeekStart()).isEqualTo("sunday");
    }

    @Test
    void leavesTheWeekStartAloneWhenAnUpdateDoesNotMentionIt() {
        when(users.save(me)).thenReturn(me);

        assertThat(service.update(ME, new Preferences(null)).weekStart()).isEqualTo("monday");
    }

    @Test
    void refusesAnyOtherDay() {
        assertThatThrownBy(() -> service.update(ME, new Preferences("friday")))
            .isInstanceOf(IllegalArgumentException.class);
        verify(users, never()).save(any());
    }
}
