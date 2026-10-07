package com.mordi.backend.repository;

import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TodoRepository extends JpaRepository<Todo, Long> {

    /** The list: everything not cleared away, open items first, each group oldest first. */
    List<Todo> findByUserAndClearedAtIsNullOrderByDoneAscCreatedAtAsc(User user);

    /** Takes finished items off the list, keeping them as history. */
    @Modifying
    @Query("update Todo t set t.clearedAt = :now "
         + "where t.user = :user and t.done = true and t.clearedAt is null")
    int clearDoneByUser(@Param("user") User user, @Param("now") Instant now);

    /** Finished on these days, cleared or not, most recent first. */
    @Query("select t from Todo t where t.user = :user and t.done = true "
         + "and t.completedOn between :start and :end "
         + "order by t.completedOn desc, t.completedAt desc, t.id desc")
    List<Todo> findFinishedBetween(
        @Param("user") User user,
        @Param("start") LocalDate start,
        @Param("end") LocalDate end);

    @Query("select count(t) from Todo t where t.user = :user and t.done = true "
         + "and t.completedOn between :start and :end")
    long countFinishedBetween(
        @Param("user") User user,
        @Param("start") LocalDate start,
        @Param("end") LocalDate end);
}
