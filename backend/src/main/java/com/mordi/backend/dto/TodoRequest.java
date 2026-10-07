package com.mordi.backend.dto;

import java.time.LocalDate;
import lombok.Data;

@Data
public class TodoRequest {
    private String text;
    private Boolean done;
    // The person's own date when they tick it off, as an entry carries its
    // logDate. Without it the server's date is used.
    private LocalDate completedOn;
}
