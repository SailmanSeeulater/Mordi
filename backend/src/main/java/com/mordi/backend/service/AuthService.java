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
    public static final String TERMS_VERSION = "2026-10-02";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

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
        String token = jwtUtil.generateToken(user.getEmail(), user.getId());
        return new AuthResponse(token, user.getEmail(), user.getName());
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository
            .findByEmail(EmailAddresses.normalize(request.getEmail()))
            .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (
            !passwordEncoder.matches(request.getPassword(), user.getPassword())
        ) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getId());
        return new AuthResponse(token, user.getEmail(), user.getName());
    }
}
