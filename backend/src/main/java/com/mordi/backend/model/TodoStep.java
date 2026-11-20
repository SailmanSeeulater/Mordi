package com.mordi.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One step of a to-do: a line of its own with its own tick. The id is made
 * by whoever adds the step (the browser or the Mac app), so a step keeps it
 * across saves without a round trip.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TodoStep {
    private String id;
    private String text;
    private boolean done;
}
