package com.mordi.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import redis.clients.jedis.JedisPool;

/**
 * A raw Jedis connection pool, used only by RateLimitFilter's bucket4j
 * integration. Separate from Spring Data Redis's own RedisConnectionFactory
 * (used everywhere else in the app) because bucket4j's Redis backend
 * talks to Jedis directly rather than through Spring's abstraction.
 */
@Configuration
public class JedisConfig {

    @Value("${spring.data.redis.host}")
    private String redisHost;

    @Value("${spring.data.redis.port}")
    private int redisPort;

    @Bean
    public JedisPool jedisPool() {
        return new JedisPool(redisHost, redisPort);
    }
}
