package com.mordi.backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI mordiOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("Mordi API")
                .description("Personal accountability tracking API — auth, entries, and reporting.")
                .version("v1"))
            .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME_NAME))
            .components(new Components()
                .addSecuritySchemes(BEARER_SCHEME_NAME, new SecurityScheme()
                    .name(BEARER_SCHEME_NAME)
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")));
    }
}