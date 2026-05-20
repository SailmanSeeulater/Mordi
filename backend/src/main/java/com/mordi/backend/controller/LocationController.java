package com.mordi.backend.controller;

import com.mordi.backend.dto.LocationRequest;
import com.mordi.backend.model.Location;
import com.mordi.backend.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    @PostMapping
    public ResponseEntity<Location> recordLocation(
            @AuthenticationPrincipal String email,
            @RequestBody LocationRequest request) {

        return ResponseEntity.ok(locationService.recordLocation(email, request));
    }

    @GetMapping
    public ResponseEntity<List<Location>> getRecentLocations(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(locationService.getRecentLocations(email));
    }

    @GetMapping("/range")
    public ResponseEntity<List<Location>> getLocationsByRange(
            @AuthenticationPrincipal String email,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(locationService.getLocationsByDateRange(email, start, end));
        }
}
