package com.mordi.backend.repository;

import com.mordi.backend.model.Note;
import com.mordi.backend.model.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {

    /** Pinned first, then most recently edited. */
    List<Note> findByUserOrderByPinnedDescUpdatedAtDesc(User user);

    long countByUser(User user);
}
