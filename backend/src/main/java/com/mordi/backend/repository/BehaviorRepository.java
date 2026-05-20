package com.mordi.backend.repository;

import com.mordi.backend.model.Behavior;
import com.mordi.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface BehaviorRepository extends JpaRepository<Behavior, Long> {
    List<Behavior> findByUserAndLogDateBetween(User user, LocalDate start, LocalDate end);
    List<Behavior> findByUserAndLogDate(User user, LocalDate date);
}
