package com.mordi.backend.repository;

import com.mordi.backend.model.Category;
import com.mordi.backend.model.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    /** The person's own categories, alphabetical, as the picker lists them. */
    List<Category> findByUserOrderByNameAsc(User user);

    long countByUser(User user);

    /** Whether the name is taken, ignoring case, as the unique index does. */
    boolean existsByUserAndNameIgnoreCase(User user, String name);

    /** The same, leaving out the category being renamed. */
    boolean existsByUserAndNameIgnoreCaseAndIdNot(User user, String name, Long id);
}
