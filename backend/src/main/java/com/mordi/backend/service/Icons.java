package com.mordi.backend.service;

import java.util.Set;

/**
 * The icon keys a goal or a category may use, and the built-in categories.
 *
 * The icons themselves are drawn in the frontend (frontend/src/lib/categories.jsx,
 * ICON_KEYS). This is the same list, so a key the frontend cannot draw is
 * refused here instead of being stored and shown as nothing. Add a key in both
 * places, or not at all.
 */
public final class Icons {

    private Icons() {}

    public static final Set<String> KEYS = Set.of(
        "thumbtack",
        "fitness",
        "sleep",
        "productivity",
        "health",
        "book",
        "run",
        "water",
        "pen",
        "music",
        "leaf",
        "sun",
        "coffee",
        "laptop",
        "lightbulb",
        "coin",
        "people",
        "paw",
        "speech",
        "sparkle",
        "check");

    /** The categories every account has. Each one's icon has the same key. */
    public static final Set<String> BUILT_IN_CATEGORIES = Set.of("fitness", "sleep", "productivity", "health");

    /** How a goal refers to one of the person's own categories: "custom:12". */
    public static final String CUSTOM_PREFIX = "custom:";

    public static boolean isKey(String key) {
        return key != null && KEYS.contains(key);
    }

    /** The id in "custom:12", or null for anything else. */
    public static Long customCategoryId(String category) {
        if (category == null || !category.startsWith(CUSTOM_PREFIX)) {
            return null;
        }
        try {
            long id = Long.parseLong(category.substring(CUSTOM_PREFIX.length()));
            return id > 0 ? id : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
