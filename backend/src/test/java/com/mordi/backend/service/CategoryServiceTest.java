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
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CategoryServiceTest {

    private static final String ME = "me@mordi.com";
    private static final String THEM = "them@mordi.com";

    @Mock private CategoryRepository categoryRepository;
    @Mock private GoalRepository goalRepository;
    @Mock private UserRepository userRepository;

    private CategoryService categoryService;
    private User me;
    private User them;

    @BeforeEach
    void setUp() {
        categoryService = new CategoryService(categoryRepository, goalRepository, userRepository);
        me = user(1L, ME);
        them = user(2L, THEM);
        when(userRepository.findByEmail(ME)).thenReturn(Optional.of(me));
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName("Someone");
        return user;
    }

    private static CategoryRequest request(String name, String icon) {
        CategoryRequest request = new CategoryRequest();
        request.setName(name);
        request.setIcon(icon);
        return request;
    }

    private Category existing(Long id, User owner) {
        Category category = new Category();
        category.setId(id);
        category.setUser(owner);
        category.setName("Reading");
        category.setIcon("book");
        return category;
    }

    @Test
    void listsOnlyMyOwn() {
        List<Category> mine = List.of(existing(5L, me));
        when(categoryRepository.findByUserOrderByNameAsc(me)).thenReturn(mine);

        assertThat(categoryService.getCategories(ME)).isSameAs(mine);
    }

    @Nested
    class Create {

        @Test
        void keepsATrimmedNameAndTheIcon() {
            Category made = categoryService.createCategory(ME, request("  Music practice ", "music"));

            assertThat(made.getUser()).isSameAs(me);
            assertThat(made.getName()).isEqualTo("Music practice");
            assertThat(made.getIcon()).isEqualTo("music");
        }

        @Test
        void refusesAnEmptyName() {
            assertThatThrownBy(() -> categoryService.createCategory(ME, request("   ", "music")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("A category needs a name");
            assertThatThrownBy(() -> categoryService.createCategory(ME, request(null, "music")))
                .isInstanceOf(IllegalArgumentException.class);
            verify(categoryRepository, never()).save(any());
        }

        @Test
        void takesFortyCharactersButNotFortyOne() {
            assertThat(categoryService.createCategory(ME, request("a".repeat(40), "pen")).getName()).hasSize(40);

            assertThatThrownBy(() -> categoryService.createCategory(ME, request("a".repeat(41), "pen")))
                .hasMessage("Keep the name to 40 characters");
        }

        @Test
        void refusesAnIconMordiCannotDraw() {
            for (String icon : new String[] {null, "", "rocket", "BOOK"}) {
                assertThatThrownBy(() -> categoryService.createCategory(ME, request("Reading", icon)))
                    .as(String.valueOf(icon))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Pick one of the icons");
            }
            verify(categoryRepository, never()).save(any());
        }

        @Test
        void refusesANameIAlreadyHaveInAnyCase() {
            when(categoryRepository.existsByUserAndNameIgnoreCase(me, "READING")).thenReturn(true);

            assertThatThrownBy(() -> categoryService.createCategory(ME, request("READING", "book")))
                .isInstanceOf(CategoryNameTakenException.class)
                .hasMessageContaining("READING");
            verify(categoryRepository, never()).save(any());
        }

        @Test
        void stopsAtTheLimit() {
            when(categoryRepository.countByUser(me)).thenReturn((long) CategoryService.MAX_CATEGORIES - 1);
            categoryService.createCategory(ME, request("Last one", "leaf"));

            when(categoryRepository.countByUser(me)).thenReturn((long) CategoryService.MAX_CATEGORIES);
            assertThatThrownBy(() -> categoryService.createCategory(ME, request("One more", "leaf")))
                .isInstanceOf(CategoryLimitReachedException.class)
                .hasMessage("You can have up to 20 categories of your own. Delete one to add another.");
            verify(categoryRepository, org.mockito.Mockito.times(1)).save(any());
        }
    }

    @Nested
    class Update {

        @Test
        void renamesAndReIcons() {
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me)));

            Category updated = categoryService.updateCategory(ME, 5L, request(" Books ", "pen"));

            assertThat(updated.getName()).isEqualTo("Books");
            assertThat(updated.getIcon()).isEqualTo("pen");
        }

        @Test
        void leavesWhatIsMissingAlone() {
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me)));

            Category updated = categoryService.updateCategory(ME, 5L, request(null, "leaf"));

            assertThat(updated.getName()).isEqualTo("Reading");
            assertThat(updated.getIcon()).isEqualTo("leaf");
        }

        @Test
        void mayChangeTheCaseOfItsOwnName() {
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me)));
            when(categoryRepository.existsByUserAndNameIgnoreCaseAndIdNot(me, "READING", 5L)).thenReturn(false);

            assertThat(categoryService.updateCategory(ME, 5L, request("READING", null)).getName()).isEqualTo("READING");
        }

        @Test
        void refusesAnotherCategorysName() {
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me)));
            when(categoryRepository.existsByUserAndNameIgnoreCaseAndIdNot(me, "Music", 5L)).thenReturn(true);

            assertThatThrownBy(() -> categoryService.updateCategory(ME, 5L, request("Music", null)))
                .isInstanceOf(CategoryNameTakenException.class);
            verify(categoryRepository, never()).save(any());
        }

        @Test
        void refusesABadIcon() {
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(existing(5L, me)));

            assertThatThrownBy(() -> categoryService.updateCategory(ME, 5L, request(null, "nope")))
                .hasMessage("Pick one of the icons");
            verify(categoryRepository, never()).save(any());
        }

        @Test
        void refusesSomeoneElsesAsNotFound() {
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(existing(5L, them)));

            assertThatThrownBy(() -> categoryService.updateCategory(ME, 5L, request("Mine now", "book")))
                .isInstanceOf(CategoryNotFoundException.class)
                .hasMessage("Category not found");
            verify(categoryRepository, never()).save(any());
        }

        @Test
        void refusesAMissingOne() {
            when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> categoryService.updateCategory(ME, 99L, request("x", "book")))
                .isInstanceOf(CategoryNotFoundException.class);
        }
    }

    @Nested
    class Delete {

        @Test
        void takesItOffItsGoalsAndThenDeletesIt() {
            Category reading = existing(5L, me);
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(reading));

            categoryService.deleteCategory(ME, 5L);

            InOrder order = inOrder(goalRepository, categoryRepository);
            order.verify(goalRepository).clearCategory("custom:5");
            order.verify(categoryRepository).delete(reading);
        }

        @Test
        void refusesSomeoneElsesAndTouchesNoGoals() {
            when(categoryRepository.findById(5L)).thenReturn(Optional.of(existing(5L, them)));

            assertThatThrownBy(() -> categoryService.deleteCategory(ME, 5L))
                .isInstanceOf(CategoryNotFoundException.class);
            verify(goalRepository, never()).clearCategory(anyString());
            verify(categoryRepository, never()).delete(any());
        }
    }

    @Test
    void theKeyAGoalUsesIsCustomAndTheId() {
        assertThat(existing(12L, me).getKey()).isEqualTo("custom:12");
        assertThat(new Category().getKey()).isNull();
    }

    @Test
    void theIconListMatchesTheFrontendSet() {
        // The frontend's ICON_KEYS, in lib/categories.jsx. Change both together.
        assertThat(Icons.KEYS).containsExactlyInAnyOrder(
            "thumbtack", "fitness", "sleep", "productivity", "health", "book", "run", "water",
            "pen", "music", "leaf", "sun", "coffee", "laptop", "lightbulb", "coin", "people",
            "paw", "speech", "sparkle", "check");
        assertThat(Icons.KEYS).containsAll(Icons.BUILT_IN_CATEGORIES);
    }

    @Test
    void readsTheIdOutOfACustomKeyOnly() {
        assertThat(Icons.customCategoryId("custom:12")).isEqualTo(12L);
        assertThat(Icons.customCategoryId("custom:0")).isNull();
        assertThat(Icons.customCategoryId("custom:-3")).isNull();
        assertThat(Icons.customCategoryId("custom:abc")).isNull();
        assertThat(Icons.customCategoryId("fitness")).isNull();
        assertThat(Icons.customCategoryId(null)).isNull();
    }
}
