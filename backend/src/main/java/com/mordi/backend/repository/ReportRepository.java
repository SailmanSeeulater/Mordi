package com.mordi.backend.repository;

import com.mordi.backend.model.Report;
import com.mordi.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByUserOrderByWeekStartDesc(User user);
}
