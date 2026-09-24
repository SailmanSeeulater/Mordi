package com.mordi.backend.repository;

import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMessage;
import com.mordi.backend.model.User;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GoalMessageRepository extends JpaRepository<GoalMessage, Long> {

    /** Newest first; the caller reverses them for reading order. */
    List<GoalMessage> findByGoalOrderByIdDesc(Goal goal, Pageable page);

    List<GoalMessage> findByGoalAndIdLessThanOrderByIdDesc(Goal goal, Long before, Pageable page);

    long countByUserAndCreatedAtAfter(User user, Instant since);

    /** Per goal, messages from others newer than where this person stopped reading. */
    @Query("select m.goal.id, count(m) from GoalMessage m, GoalMember gm "
        + "where gm.user = :user and gm.goal = m.goal and m.user <> :user "
        + "and m.id > gm.lastReadMessageId group by m.goal.id")
    List<Object[]> countUnread(@Param("user") User user);
}
