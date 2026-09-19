package com.mordi.backend.repository;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface BehaviorRepository extends JpaRepository<Behavior, Long> {
    List<Behavior> findByUserAndLogDateBetween(User user, LocalDate start, LocalDate end);
    List<Behavior> findByUserAndLogDate(User user, LocalDate date);

    /**
     * One row per goal that has any entries:
     * [goalId, entries, completed entries, first log date, last log date].
     * Used by History, so an archived goal can say what it amounted to.
     */
    @Query("select b.goal.id, count(b), sum(case when b.completed = true then 1 else 0 end), "
        + "min(b.logDate), max(b.logDate) "
        + "from Behavior b where b.user = :user and b.goal.id in :goalIds group by b.goal.id")
    List<Object[]> summarizeByGoal(@Param("user") User user, @Param("goalIds") Collection<Long> goalIds);
}
