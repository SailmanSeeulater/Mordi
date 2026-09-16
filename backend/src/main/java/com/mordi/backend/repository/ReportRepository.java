package com.mordi.backend.repository;

import com.mordi.backend.model.Report;
import com.mordi.backend.model.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByUserOrderByWeekStartDesc(User user);

    /** One report per user per week, so regenerating replaces rather than appends. */
    Optional<Report> findByUserAndWeekStart(User user, LocalDate weekStart);
}
