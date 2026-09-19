package com.mordi.backend.dto;

import lombok.Data;

/** "Did it happen?": done (optionally against a goal, with a mood) or skipped. */
@Data
public class EventOutcomeRequest {
    private String outcome;
    private Long goalId;
    private String mood;
}
