package com.mordi.backend.repository;

import com.mordi.backend.model.Location;
import com.mordi.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LocationRepository extends JpaRepository<Location, Long> {
    List<Location> findByUserAndRecordedAtBetween(User user, LocalDateTime start, LocalDateTime end);
    List<Location> findByUserOrderByRecordedAtDesc(User user);
}
