package com.mordi.backend.service;

import com.mordi.backend.dto.CategoryRequest;
import com.mordi.backend.exception.CategoryLimitReachedException;
import com.mordi.backend.exception.CategoryNameTakenException;
import com.mordi.backend.exception.CategoryNotFoundException;
import com.mordi.backend.model.Category;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.CategoryRepository;
import com.mordi.backend.repository.GoalRepository;
import com.mordi.backend.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A person's own goal categories: a name and one of the drawn icons.
 *
 * A goal points at one as "custom:<id>" in its category string, beside the
 * four built-in keys, so a category can be renamed or re-iconed without
 * touching any goal. Deleting one takes it off its goals in the same
 * transaction.
 */
@Service
@RequiredArgsConstructor
public class CategoryService {

    /** Enough to sort a life into; few enough to fit one picker. */
    public static final int MAX_CATEGORIES = 20;

    public static final int MAX_NAME = 40;

    private final CategoryRepository categoryRepository;
    private final GoalRepository goalRepository;
    private final UserRepository userRepository;

    public List<Category> getCategories(String email) {
        return categoryRepository.findByUserOrderByNameAsc(findUser(email));
    }

    public Category createCategory(String email, CategoryRequest request) {
        User user = findUser(email);
        String name = requireName(request.getName());
        String icon = requireIcon(request.getIcon());

        if (categoryRepository.countByUser(user) >= MAX_CATEGORIES) {
            throw new CategoryLimitReachedException(MAX_CATEGORIES);
        }
        if (categoryRepository.existsByUserAndNameIgnoreCase(user, name)) {
            throw new CategoryNameTakenException(name);
        }

        Category category = new Category();
        category.setUser(user);
        category.setName(name);
        category.setIcon(icon);
        return categoryRepository.save(category);
    }

    /** Renames it, re-icons it, or both. A missing field is left alone. */
    public Category updateCategory(String email, Long categoryId, CategoryRequest request) {
        Category category = findOwnedCategory(email, categoryId);

        if (request.getName() != null) {
            String name = requireName(request.getName());
            if (categoryRepository.existsByUserAndNameIgnoreCaseAndIdNot(category.getUser(), name, category.getId())) {
                throw new CategoryNameTakenException(name);
            }
            category.setName(name);
        }
        if (request.getIcon() != null) {
            category.setIcon(requireIcon(request.getIcon()));
        }

        return categoryRepository.save(category);
    }

    /**
     * Deletes it and takes it off every goal that had it, together: a goal is
     * never left pointing at a category that is gone. The goals keep their own
     * icon if they chose one; otherwise they show the thumbtack.
     */
    @Transactional
    public void deleteCategory(String email, Long categoryId) {
        Category category = findOwnedCategory(email, categoryId);
        goalRepository.clearCategory(category.getKey());
        categoryRepository.delete(category);
    }

    /**
     * Categories belonging to someone else are reported exactly like ones that
     * do not exist, so ids from other accounts cannot be probed.
     */
    private Category findOwnedCategory(String email, Long categoryId) {
        return categoryRepository
            .findById(categoryId)
            .filter(category -> category.getUser().getEmail().equals(email))
            .orElseThrow(CategoryNotFoundException::new);
    }

    private String requireName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("A category needs a name");
        }
        if (trimmed.length() > MAX_NAME) {
            throw new IllegalArgumentException("Keep the name to " + MAX_NAME + " characters");
        }
        return trimmed;
    }

    private String requireIcon(String icon) {
        if (!Icons.isKey(icon)) {
            throw new IllegalArgumentException("Pick one of the icons");
        }
        return icon;
    }

    private User findUser(String email) {
        return userRepository
            .findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
