package com.mordi.backend.repository;

import com.mordi.backend.model.PlanEvent;
import com.mordi.backend.model.User;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
