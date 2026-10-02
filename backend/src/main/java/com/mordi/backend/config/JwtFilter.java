package com.mordi.backend.config;

import com.mordi.backend.repository.UserRepository;
import com.mordi.backend.service.EmailAddresses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    /**
     * A signature alone is not enough: the account it was issued to has to
     * still exist, and be the same account. Without that check a deleted
     * account's token kept working until it expired, and if the address was
     * signed up again meanwhile, it opened the new account.
     *
     * A token that fails is simply not trusted, so the request is answered
     * 401 and the client trades its refresh cookie for a fresh token, which
     * is also what happens to tokens issued before the id was added to them.
     */
    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            JwtUtil.Claims claims = jwtUtil.parse(authHeader.substring(7));
            if (claims != null && claims.userId() != null) {
                String email = EmailAddresses.normalize(claims.email());
                boolean sameAccount = userRepository.findByEmail(email)
                    .map(user -> user.getId().equals(claims.userId()))
                    .orElse(false);
                if (sameAccount) {
                    UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(email, null, List.of());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
