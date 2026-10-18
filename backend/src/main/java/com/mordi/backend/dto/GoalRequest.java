package com.mordi.backend.dto;

import lombok.Data;

@Data
public class GoalRequest {

    private String title;
    private String description;
    private String frequency;
    private String category;
    // A key from Icons.KEYS, or "" to go back to the category's icon.
    private String icon;
    private Integer targetPerWeek;
    private String placeName;
}
