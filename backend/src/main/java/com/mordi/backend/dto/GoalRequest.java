package com.mordi.backend.dto;

import lombok.Data;

@Data
public class GoalRequest {

    private String title;
    private String description;
    private String frequency;
    private String category;
}
