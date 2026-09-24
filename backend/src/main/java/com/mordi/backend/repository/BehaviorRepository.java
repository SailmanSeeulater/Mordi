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

    /** One row per named place: [placeName, visits, last log date, avg latitude, avg longitude]. */
    @Query("select b.placeName, count(b), max(b.logDate), avg(b.latitude), avg(b.longitude) "
        + "from Behavior b where b.user = :user and b.placeName is not null "
        + "group by b.placeName order by count(b) desc")
    List<Object[]> summarizePlaces(@Param("user") User user);

    java.util.Optional<Behavior> findByIdAndUser(Long id, User user);

    /**
     * For a shared goal's week: who marked it done on which day. Only the
     * person and the date; notes, moods and places stay with their owner.
     */
    @Query("select distinct b.user.id, b.logDate from Behavior b where b.goal.id = :goalId "
        + "and b.completed = true and b.logDate between :start and :end")
    List<Object[]> completedDaysForGoal(@Param("goalId") Long goalId,
                                        @Param("start") LocalDate start,
                                        @Param("end") LocalDate end);
}
