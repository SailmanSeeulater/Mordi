package com.mordi.backend.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class PlanEventRequest {
    private String title;
    private String notes;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private Boolean allDay;
    private String color;
    private String placeName;
}
