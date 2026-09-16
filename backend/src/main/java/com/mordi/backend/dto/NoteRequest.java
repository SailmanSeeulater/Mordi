package com.mordi.backend.dto;

import lombok.Data;

@Data
public class NoteRequest {
    private String title;
    private String body;
    private Boolean pinned;
}
