package com.mordi.backend.repository;

import com.mordi.backend.model.DailyStats;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DailyStatsRepository extends JpaRepository<DailyStats, LocalDate> {

    /** The last 90 days written, newest first. */
    List<DailyStats> findTop90ByOrderByDayDesc();
}
