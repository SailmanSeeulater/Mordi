package com.mordi.backend.controller;

import com.mordi.backend.dto.CategoryRequest;
import com.mordi.backend.model.Category;
import com.mordi.backend.service.CategoryService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ResponseEntity<List<Category>> getCategories(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(categoryService.getCategories(email));
    }

    @PostMapping
    public ResponseEntity<Category> createCategory(
            @AuthenticationPrincipal String email,
            @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(categoryService.createCategory(email, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Category> updateCategory(
            @AuthenticationPrincipal String email,
            @PathVariable Long id,
            @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(categoryService.updateCategory(email, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(
            @AuthenticationPrincipal String email,
            @PathVariable Long id) {
        categoryService.deleteCategory(email, id);
        return ResponseEntity.noContent().build();
    }
}
