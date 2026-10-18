package com.mordi.backend.repository;

import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findByUserAndActive(User user, boolean active);

    /** Current goals: not deleted, not archived. What the dashboard shows. */
    List<Goal> findByUserAndActiveTrueAndArchivedAtIsNull(User user);

    /** History: archived but not deleted, most recently archived first. */
    List<Goal> findByUserAndActiveTrueAndArchivedAtIsNotNullOrderByArchivedAtDesc(User user);

    /** Goals made in [from, to), for the usage totals. */
    @Query("select count(g) from Goal g where g.createdAt >= :from and g.createdAt < :to")
    long countCreatedBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * Takes a category off every goal that has it, archived and deleted goals
     * included, so none is left pointing at a category that is gone. Flushes
     * first and clears after, so goals already loaded are not saved back over
     * it with the old value.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Goal g set g.category = null where g.category = :category")
    int clearCategory(@Param("category") String category);
}
