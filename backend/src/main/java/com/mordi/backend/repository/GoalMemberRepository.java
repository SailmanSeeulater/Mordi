package com.mordi.backend.repository;

import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalMember;
import com.mordi.backend.model.User;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GoalMemberRepository extends JpaRepository<GoalMember, Long> {

    Optional<GoalMember> findByGoalAndUser(Goal goal, User user);

    boolean existsByGoalAndUser(Goal goal, User user);

    List<GoalMember> findByGoalOrderByJoinedAtAsc(Goal goal);

    long countByGoal(Goal goal);

    /** Current goals someone else owns that this person has joined. */
    @Query("select m.goal from GoalMember m where m.user = :user and m.goal.user <> :user "
        + "and m.goal.active = true and m.goal.archivedAt is null")
    List<Goal> findJoinedGoals(@Param("user") User user);

    /** Goal id and head count, for the goals given. */
    @Query("select m.goal.id, count(m) from GoalMember m where m.goal.id in :goalIds group by m.goal.id")
    List<Object[]> countByGoalIds(@Param("goalIds") Collection<Long> goalIds);
}
