package com.mordi.backend.repository;

import com.mordi.backend.model.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    /**
     * One DELETE, leaving the database to cascade to everything the account
     * owns. Pending changes are flushed first, so a goal handed to someone
     * else is theirs before its old owner's rows go.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from User u where u.id = :id")
    int deleteUserById(@Param("id") Long id);

    /** Everyone who has reminders switched on. */
    java.util.List<User> findByReminderHourIsNotNull();
    boolean existsByEmail(String email);
}
