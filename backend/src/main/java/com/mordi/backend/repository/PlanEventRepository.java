package com.mordi.backend.repository;

import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.User;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PlanEventRepository extends JpaRepository<PlanEvent, Long> {

    /**
     * Events overlapping [from, to): those starting before the range ends and
     * ending after it starts. Catches an event that began last week and runs
     * into this one, which a "starts within" query would miss.
     */
    List<PlanEvent> findByUserAndStartsAtLessThanAndEndsAtGreaterThanOrderByStartsAtAsc(
        User user, LocalDateTime to, LocalDateTime from);

    Optional<PlanEvent> findByIdAndUser(Long id, User user);

    /** Every copy taken from one connected calendar, for a sync to compare against. */
    List<PlanEvent> findByFeedId(Long feedId);

    /** A connected calendar's new colour reaches its events, without loading them. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PlanEvent e set e.color = :color where e.feedId = :feedId")
    int updateColorByFeedId(@Param("feedId") Long feedId, @Param("color") String color);

    /** Every event, imported ones too: the data export. */
    List<PlanEvent> findByUserOrderByStartsAtAsc(User user);
}
