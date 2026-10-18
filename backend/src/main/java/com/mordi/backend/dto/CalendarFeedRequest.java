package com.mordi.backend.dto;

import lombok.Data;

/**
 * Connecting a Google Calendar (url, and optionally name and colour), or
 * renaming and recolouring one (name and colour only; the address cannot be
 * changed, only disconnected and connected again). timeZone is the browser's,
 * so events convert into the zone the person is actually in.
 */
@Data
public class CalendarFeedRequest {
    private String url;
    private String name;
    private String color;
    private String timeZone;
}
