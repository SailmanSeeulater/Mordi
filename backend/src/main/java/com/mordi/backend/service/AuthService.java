package com.mordi.backend.service;

import com.mordi.backend.config.JwtUtil;
import com.mordi.backend.dto.AuthRequest;
import com.mordi.backend.dto.AuthResponse;
import com.mordi.backend.exception.EmailAlreadyExistsException;
import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    /**
     * The Terms and Privacy Policy shown under the sign-up button, by date.
     * Bump together with LEGAL.version in frontend/src/lib/legal.js whenever
     * either page changes in substance.
     */
    public static final String TERMS_VERSION = "2026-10-18";

    /**
     * A bcrypt hash of nothing in particular, checked against when the
     * address is unknown. Without it a sign-in with a wrong address answers
     * in a millisecond and one with a wrong password in a hundred, and the
     * difference tells which addresses have accounts.
     */
    static final String DUMMY_HASH = "$2a$10$1Li0KXXd9HiJdsGDAoTGEukDblsOnt8pwdynaBNjMWIfHKm6IzrZW";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final ActivityService activityService;

    public AuthResponse register(AuthRequest request) {
        String email = EmailAddresses.normalize(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException("Email already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        // Creating an account is agreeing to the Terms: the sign-up form says
        // so beside the button.
        user.setTermsVersion(TERMS_VERSION);
        user.setTermsAcceptedAt(LocalDateTime.now());
        userRepository.save(user);
        activityService.markActive(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getId());
        return new AuthResponse(token, user.getEmail(), user.getName());
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository
            .findByEmail(EmailAddresses.normalize(request.getEmail()))
            .orElseThrow(() -> {
                passwordEncoder.matches(request.getPassword(), DUMMY_HASH);
                return new InvalidCredentialsException("Invalid email or password");
            });

        if (
            !passwordEncoder.matches(request.getPassword(), user.getPassword())
        ) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        activityService.markActive(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getId());
        return new AuthResponse(token, user.getEmail(), user.getName());
    }
}
