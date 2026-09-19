package com.mordi.backend.repository;

import com.mordi.backend.model.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    /** Everyone who has reminders switched on. */
    java.util.List<User> findByReminderHourIsNotNull();
    boolean existsByEmail(String email);
}
