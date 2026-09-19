package com.mordi.backend.repository;

import com.mordi.backend.model.Goal;
import com.mordi.backend.model.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findByUserAndActive(User user, boolean active);

    /** Current goals: not deleted, not archived. What the dashboard shows. */
    List<Goal> findByUserAndActiveTrueAndArchivedAtIsNull(User user);

    /** History: archived but not deleted, most recently archived first. */
    List<Goal> findByUserAndActiveTrueAndArchivedAtIsNotNullOrderByArchivedAtDesc(User user);
}
