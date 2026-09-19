package com.mordi.backend.dto;

import java.time.LocalDate;

/**
 * A place, as the entries logged there describe it: how often, how recently,
 * and where on the map (the average of the fixes taken there, or null when
 * the place was only ever named).
 */
public record PlaceSummary(String placeName, long visits, LocalDate lastVisit, Double latitude, Double longitude) {
}
