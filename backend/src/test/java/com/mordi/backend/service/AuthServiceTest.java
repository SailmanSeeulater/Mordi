package com.mordi.backend.service;

import com.mordi.backend.config.JwtUtil;
import com.mordi.backend.dto.AuthRequest;
import com.mordi.backend.dto.AuthResponse;
import com.mordi.backend.exception.EmailAlreadyExistsException;
import com.mordi.backend.exception.InvalidCredentialsException;
import com.mordi.backend.model.User;
import com.mordi.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AuthService. Mocks the repository, password encoder, and
 * JWT util so these run in milliseconds with no database or Spring context.
 *
 * AuthService throws EmailAlreadyExistsException on duplicate registration
 * and InvalidCredentialsException on any login failure. Login deliberately
 * uses the same exception and message whether the email doesn't exist or
 * the password is wrong -- see InvalidCredentialsException's javadoc for
 * why (account enumeration prevention). Don't split these assertions back
 * into distinct messages per failure mode.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, jwtUtil);
    }

    // ---- register() ------------------------------------------------------

    @Test
    void register_withNewEmail_createsUserAndReturnsToken() {
        AuthRequest request = new AuthRequest();
        request.setEmail("new@mordi.com");
        request.setPassword("plainPassword123");
        request.setName("New Sailor");

        when(userRepository.existsByEmail("new@mordi.com")).thenReturn(false);
        when(passwordEncoder.encode("plainPassword123")).thenReturn("hashed-password");
        when(jwtUtil.generateToken("new@mordi.com")).thenReturn("fake-jwt-token");

        AuthResponse response = authService.register(request);

        assertThat(response.getToken()).isEqualTo("fake-jwt-token");
        assertThat(response.getEmail()).isEqualTo("new@mordi.com");
        assertThat(response.getName()).isEqualTo("New Sailor");

        // Confirm the password was hashed before persisting -- never saved in plaintext
        ArgumentCaptor<User> savedUser = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedUser.capture());
        assertThat(savedUser.getValue().getPassword()).isEqualTo("hashed-password");
        assertThat(savedUser.getValue().getEmail()).isEqualTo("new@mordi.com");
    }

    @Test
    void register_withExistingEmail_throwsAndNeverSaves() {
        AuthRequest request = new AuthRequest();
        request.setEmail("taken@mordi.com");
        request.setPassword("whatever");
        request.setName("Someone");

        when(userRepository.existsByEmail("taken@mordi.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
            .isInstanceOf(EmailAlreadyExistsException.class)
            .hasMessageContaining("already registered");

        // The important behavioral guarantee, regardless of exception type:
        // a duplicate-email attempt must never reach the database.
        verify(userRepository, never()).save(any());
        verify(jwtUtil, never()).generateToken(anyString());
    }

    @Test
    void register_neverPersistsPlaintextPassword() {
        AuthRequest request = new AuthRequest();
        request.setEmail("secure@mordi.com");
        request.setPassword("superSecret1!");
        request.setName("Secure User");

        when(userRepository.existsByEmail("secure@mordi.com")).thenReturn(false);
        when(passwordEncoder.encode("superSecret1!")).thenReturn("$2a$10$hashedvalue");
        when(jwtUtil.generateToken(anyString())).thenReturn("token");

        authService.register(request);

        ArgumentCaptor<User> savedUser = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedUser.capture());
        assertThat(savedUser.getValue().getPassword())
            .isNotEqualTo("superSecret1!")
            .startsWith("$2a$"); // bcrypt hash prefix
    }

    // ---- login() -----------------------------------------------------------

    @Test
    void login_withCorrectCredentials_returnsToken() {
        AuthRequest request = new AuthRequest();
        request.setEmail("existing@mordi.com");
        request.setPassword("correctPassword");

        User existingUser = new User();
        existingUser.setEmail("existing@mordi.com");
        existingUser.setPassword("hashed-existing-password");
        existingUser.setName("Existing User");

        when(userRepository.findByEmail("existing@mordi.com"))
            .thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches("correctPassword", "hashed-existing-password"))
            .thenReturn(true);
        when(jwtUtil.generateToken("existing@mordi.com")).thenReturn("valid-token");

        AuthResponse response = authService.login(request);

        assertThat(response.getToken()).isEqualTo("valid-token");
        assertThat(response.getEmail()).isEqualTo("existing@mordi.com");
        assertThat(response.getName()).isEqualTo("Existing User");
    }

    @Test
    void login_withWrongPassword_throwsAndNeverIssuesToken() {
        AuthRequest request = new AuthRequest();
        request.setEmail("existing@mordi.com");
        request.setPassword("wrongPassword");

        User existingUser = new User();
        existingUser.setEmail("existing@mordi.com");
        existingUser.setPassword("hashed-existing-password");

        when(userRepository.findByEmail("existing@mordi.com"))
            .thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches("wrongPassword", "hashed-existing-password"))
            .thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
            .isInstanceOf(InvalidCredentialsException.class)
            .hasMessageContaining("Invalid email or password");

        verify(jwtUtil, never()).generateToken(anyString());
    }

    @Test
    void login_withUnknownEmail_throwsAndNeverChecksPassword() {
        AuthRequest request = new AuthRequest();
        request.setEmail("ghost@mordi.com");
        request.setPassword("anything");

        when(userRepository.findByEmail("ghost@mordi.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
            .isInstanceOf(InvalidCredentialsException.class)
            .hasMessageContaining("Invalid email or password");

        // Should short-circuit before ever touching the password encoder
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(jwtUtil, never()).generateToken(anyString());
    }
}