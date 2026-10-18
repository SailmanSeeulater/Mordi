package com.mordi.backend.repository;

import com.mordi.backend.model.CalendarFeed;
import com.mordi.backend.model.User;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface CalendarFeedRepository extends JpaRepository<CalendarFeed, Long> {

    List<CalendarFeed> findByUserOrderByIdAsc(User user);

    Optional<CalendarFeed> findByIdAndUser(Long id, User user);

    long countByUser(User user);

    boolean existsByUserAndUrlHash(User user, String urlHash);

    /**
     * The feeds worth refreshing on a timer: those whose owner has used Mordi
     * on {@code since} or later. Ids only, so a run holds one feed in memory
     * at a time.
     */
    @Query("select f.id from CalendarFeed f where f.user.lastActiveOn >= :since order by f.id")
    List<Long> findIdsWithOwnerActiveSince(@Param("since") LocalDate since);

    /**
     * The outcome of a sync that worked. A targeted update rather than a save,
     * so a rename that lands mid-sync is not written back over.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update CalendarFeed f set f.eventCount = :count, f.lastSyncedAt = :at, f.lastError = null "
         + "where f.id = :id")
    int recordSynced(@Param("id") Long id, @Param("count") int count, @Param("at") LocalDateTime at);

    /** A sync that failed: the reason, and nothing else changes, events included. */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update CalendarFeed f set f.lastError = :error where f.id = :id")
    int recordError(@Param("id") Long id, @Param("error") String error);
}
