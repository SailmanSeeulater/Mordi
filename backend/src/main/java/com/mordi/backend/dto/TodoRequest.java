package com.mordi.backend.dto;

import com.mordi.backend.model.TodoStep;
import java.time.LocalDate;
import java.util.List;
import lombok.Data;

@Data
public class TodoRequest {
    private String text;
    private Boolean done;
    // The person's own date when they tick it off, as an entry carries its
    // logDate. Without it the server's date is used.
    private LocalDate completedOn;
    // The whole list of steps, replacing what was there. Absent leaves them
    // alone; empty clears them.
    private List<TodoStep> steps;
}
