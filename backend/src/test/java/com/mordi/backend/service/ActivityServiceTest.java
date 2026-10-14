package com.mordi.backend.service;

import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/** The once-a-day mark, with a fixed UTC clock so the day can be moved. */
@ExtendWith(MockitoExtension.class)
class ActivityServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);

    @Mock private UserRepository userRepository;

    private ActivityService activity;

    @BeforeEach
    void setUp() {
        // 23:59:59 UTC: still the 14th here, though already the 15th in
        // Tokyo, so a service that used the machine's zone would disagree.
        Clock clock = Clock.fixed(Instant.parse("2026-10-14T23:59:59Z"), ZoneId.of("UTC"));
        activity = new ActivityService(userRepository, clock);
    }

    private static User person(LocalDate lastActiveOn) {
        User user = new User();
        user.setId(7L);
        user.setEmail("me@mordi.com");
        user.setLastActiveOn(lastActiveOn);
        return user;
    }

    @Test
    void anAccountNeverSeenBeforeIsMarkedToday() {
        activity.markActive(person(null));

        verify(userRepository).markActiveOn(7L, TODAY);
    }

    @Test
    void anAccountLastSeenOnAnEarlierDayIsMarkedToday() {
        activity.markActive(person(TODAY.minusDays(1)));

        verify(userRepository).markActiveOn(7L, TODAY);
    }

    @Test
    void anAccountAlreadyMarkedTodayCostsNoWrite() {
        activity.markActive(person(TODAY));

        verifyNoInteractions(userRepository);
    }

    @Test
    void anAccountWithoutAnIdIsLeftAlone() {
        User unsaved = person(null);
        unsaved.setId(null);

        activity.markActive(unsaved);

        verify(userRepository, never()).markActiveOn(anyLong(), any());
    }

    @Test
    void aFailureToRecordItNeverReachesTheRequest() {
        doThrow(new IllegalStateException("database is down"))
            .when(userRepository).markActiveOn(7L, TODAY);

        assertThatCode(() -> activity.markActive(person(null))).doesNotThrowAnyException();
    }
}
