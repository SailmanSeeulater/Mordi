package com.mordi.backend.service;

import com.mordi.backend.dto.LocationRequest;
import com.mordi.backend.model.Location;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.LocationRepository;
import com.mordi.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;
    private final UserRepository userRepository;

    public Location recordLocation(String email, LocationRequest request) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

        Location location = new Location();
        location.setUser(user);
        location.setLatitude(request.getLatitude());
        location.setLongitude(request.getLongitude());
        location.setPlaceName(request.getPlaceName());
        location.setRecordedAt(request.getRecordedAt() != null ? request.getRecordedAt() : LocalDateTime.now());

        return locationRepository.save(location);
    }

    public List<Location> getRecentLocations(String email) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
        return locationRepository.findByUserOrderByRecordedAtDesc(user);
    }

    public List<Location> getLocationsByDateRange(String email, LocalDateTime start, LocalDateTime end) {
        User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
        return locationRepository.findByUserAndRecordedAtBetween(user, start, end);
    }
}
