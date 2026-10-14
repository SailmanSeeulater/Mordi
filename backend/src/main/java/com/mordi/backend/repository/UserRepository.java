package com.mordi.backend.repository;

import com.mordi.backend.model.User;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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

    /**
     * Marks the person as having used Mordi on this day. The condition makes
     * it a no-op when the day is already recorded, so asking twice is one
     * write. Its own transaction, because the caller (the JWT filter) has
     * none, and a failure here must not reach into the caller's.
     */
    @Transactional
    @Modifying
    @Query("update User u set u.lastActiveOn = :today "
         + "where u.id = :id and (u.lastActiveOn is null or u.lastActiveOn <> :today)")
    int markActiveOn(@Param("id") Long id, @Param("today") LocalDate today);

    /** Accounts made in [from, to). */
    @Query("select count(u) from User u where u.createdAt >= :from and u.createdAt < :to")
    long countCreatedBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Accounts last seen on this day. */
    long countByLastActiveOn(LocalDate day);

    /** Accounts last seen on this day or since. */
    long countByLastActiveOnGreaterThanEqual(LocalDate day);

    /** Of the accounts made in [from, to), those last seen on {@code since} or later. */
    @Query("select count(u) from User u where u.createdAt >= :from and u.createdAt < :to "
         + "and u.lastActiveOn >= :since")
    long countCreatedBetweenAndActiveSince(
        @Param("from") LocalDateTime from,
        @Param("to") LocalDateTime to,
        @Param("since") LocalDate since);

    /** Everyone who has reminders switched on. */
    java.util.List<User> findByReminderHourIsNotNull();
    boolean existsByEmail(String email);
}
