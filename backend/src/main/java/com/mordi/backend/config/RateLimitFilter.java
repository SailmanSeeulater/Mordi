package com.mordi.backend.config;

import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.distributed.serialization.Mapper;
import io.github.bucket4j.redis.jedis.Bucket4jJedis;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import redis.clients.jedis.JedisPool;

import java.io.IOException;
import java.time.Duration;
import java.util.function.Supplier;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int CAPACITY = 5;
    private static final Duration REFILL_PERIOD = Duration.ofMinutes(1);

    private final ProxyManager<String> proxyManager;

    public RateLimitFilter(JedisPool jedisPool) {
        this.proxyManager = Bucket4jJedis.casBasedBuilder(jedisPool)
            .keyMapper(Mapper.STRING)
            .build();
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {

        if (!isRateLimited(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        BucketProxy bucket = resolveBucket(clientIp);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"status\":429,\"error\":\"Too many login attempts. Please wait a minute and try again.\"}"
            );
        }
    }

    private boolean isRateLimited(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
            && "/api/auth/login".equals(request.getRequestURI());
    }

    private BucketProxy resolveBucket(String clientIp) {
        String key = "rate-limit:login:" + clientIp;
        Supplier<BucketConfiguration> configSupplier = () -> BucketConfiguration.builder()
            .addLimit(limit -> limit.capacity(CAPACITY).refillGreedy(CAPACITY, REFILL_PERIOD))
            .build();
        return proxyManager.getProxy(key, configSupplier);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
