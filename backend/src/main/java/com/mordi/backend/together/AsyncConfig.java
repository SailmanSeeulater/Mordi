package com.mordi.backend.together;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/** @Async runs on Spring Boot's application task executor. */
@Configuration
@EnableAsync
public class AsyncConfig {
}
