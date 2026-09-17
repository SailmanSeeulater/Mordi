package com.mordi.backend.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class BehaviorRequest {
    private Long goalId;
    private String note;
    private boolean completed;
    private String mood;
    private LocalDate logDate;
    private Double latitude;
    private Double longitude;
    private String placeName;
    private Integer durationSeconds;
}
