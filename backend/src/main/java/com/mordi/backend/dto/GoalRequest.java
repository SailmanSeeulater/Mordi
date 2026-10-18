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
    // A weekday mask, bit 0 Monday to bit 6 Sunday, 0 to 127. 0 clears the
    // planned days; missing leaves them alone. When days are set they decide
    // targetPerWeek, whatever targetPerWeek says.
    private Integer plannedDays;
    private String placeName;
}
