package com.mordi.backend.repository;

import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TodoRepository extends JpaRepository<Todo, Long> {

    /** The list: everything not cleared or removed, open items first, each group oldest first. */
    List<Todo> findByUserAndClearedAtIsNullAndRemovedAtIsNullOrderByDoneAscCreatedAtAsc(User user);

    /**
     * History: what was done or removed, by the moment it left the list,
     * newest first, a page at a time.
     */
    @Query("select t from Todo t where t.user = :user and (t.done = true or t.removedAt is not null) "
         + "order by coalesce(t.removedAt, t.completedAt) desc, t.id desc")
    Slice<Todo> findHistory(@Param("user") User user, Pageable page);

    /** Takes finished items off the list, keeping them as history. */
    @Modifying
    @Query("update Todo t set t.clearedAt = :now "
         + "where t.user = :user and t.done = true and t.clearedAt is null and t.removedAt is null")
    int clearDoneByUser(@Param("user") User user, @Param("now") Instant now);

    /** Finished on these days, cleared or not, most recent first. Removed ones don't count. */
    @Query("select t from Todo t where t.user = :user and t.done = true and t.removedAt is null "
         + "and t.completedOn between :start and :end "
         + "order by t.completedOn desc, t.completedAt desc, t.id desc")
    List<Todo> findFinishedBetween(
        @Param("user") User user,
        @Param("start") LocalDate start,
        @Param("end") LocalDate end);

    @Query("select count(t) from Todo t where t.user = :user and t.done = true and t.removedAt is null "
         + "and t.completedOn between :start and :end")
    long countFinishedBetween(
        @Param("user") User user,
        @Param("start") LocalDate start,
        @Param("end") LocalDate end);

    /** Everyone's to-dos finished on this day, for the usage totals. */
    @Query("select count(t) from Todo t where t.done = true and t.removedAt is null and t.completedOn = :day")
    long countFinishedOn(@Param("day") LocalDate day);

    /** Every to-do, cleared ones too: the data export. */
    List<Todo> findByUserOrderByCreatedAtAsc(User user);
}
