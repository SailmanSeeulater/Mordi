package com.mordi.backend.repository;

import com.mordi.backend.model.Goal;
import com.mordi.backend.model.GoalInvite;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GoalInviteRepository extends JpaRepository<GoalInvite, Long> {

    Optional<GoalInvite> findByTokenHash(String tokenHash);

    List<GoalInvite> findByGoalAndRevokedAtIsNull(Goal goal);
}
