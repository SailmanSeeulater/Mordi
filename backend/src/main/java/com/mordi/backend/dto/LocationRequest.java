package com.mordi.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class LocationRequest {
    private Double latitude;
    private Double longitude;
    private String placeName;
    private LocalDateTime recordedAt;
}
