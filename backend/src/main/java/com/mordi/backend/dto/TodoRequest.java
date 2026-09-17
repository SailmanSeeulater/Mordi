package com.mordi.backend.dto;

import lombok.Data;

@Data
public class TodoRequest {
    private String text;
    private Boolean done;
}
