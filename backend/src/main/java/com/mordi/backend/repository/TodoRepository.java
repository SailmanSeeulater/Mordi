package com.mordi.backend.repository;

import com.mordi.backend.model.Todo;
import com.mordi.backend.model.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TodoRepository extends JpaRepository<Todo, Long> {

    /** Open items first, each group in the order it was added. */
    List<Todo> findByUserOrderByDoneAscCreatedAtAsc(User user);

    @Modifying
    @Query("delete from Todo t where t.user = :user and t.done = true")
    int deleteDoneByUser(@Param("user") User user);
}
