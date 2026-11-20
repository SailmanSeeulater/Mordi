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

    /*
     * The usage counts below leave out guest accounts ("Try it"), which are
     * deleted within a week and would otherwise read as sign-ups. A guest who
     * saves their account counts from then on, under the day it was opened.
     */

    /** Saved accounts, all of them. */
    @Query("select count(u) from User u where u.guestUntil is null")
    long countSaved();

    /** Accounts made in [from, to). */
    @Query("select count(u) from User u where u.createdAt >= :from and u.createdAt < :to "
         + "and u.guestUntil is null")
    long countCreatedBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Accounts last seen on this day. */
    @Query("select count(u) from User u where u.lastActiveOn = :day and u.guestUntil is null")
    long countByLastActiveOn(@Param("day") LocalDate day);

    /** Accounts last seen on this day or since. */
    @Query("select count(u) from User u where u.lastActiveOn >= :day and u.guestUntil is null")
    long countByLastActiveOnGreaterThanEqual(@Param("day") LocalDate day);

    /** Of the accounts made in [from, to), those last seen on {@code since} or later. */
    @Query("select count(u) from User u where u.createdAt >= :from and u.createdAt < :to "
         + "and u.lastActiveOn >= :since and u.guestUntil is null")
    long countCreatedBetweenAndActiveSince(
        @Param("from") LocalDateTime from,
        @Param("to") LocalDateTime to,
        @Param("since") LocalDate since);

    /** Everyone who has reminders switched on. */
    java.util.List<User> findByReminderHourIsNotNull();
    boolean existsByEmail(String email);

    /** Guest accounts still open at this moment. */
    long countByGuestUntilAfter(LocalDateTime moment);

    /** Guest accounts whose week was up before this moment. */
    @Query("select u.id from User u where u.guestUntil < :moment")
    java.util.List<Long> findIdsByGuestUntilBefore(@Param("moment") LocalDateTime moment);

    /**
     * Everything the guest cap counts, all kinds together: goals, entries,
     * to-dos, notes, places, calendar events and categories. One round trip,
     * each part on an index that starts with user_id.
     */
    @Query(nativeQuery = true, value = "select "
         + "(select count(*) from goals where user_id = :id) "
         + "+ (select count(*) from behaviors where user_id = :id) "
         + "+ (select count(*) from todos where user_id = :id) "
         + "+ (select count(*) from notes where user_id = :id) "
         + "+ (select count(*) from locations where user_id = :id) "
         + "+ (select count(*) from plan_events where user_id = :id) "
         + "+ (select count(*) from categories where user_id = :id)")
    long countItems(@Param("id") Long id);
}
