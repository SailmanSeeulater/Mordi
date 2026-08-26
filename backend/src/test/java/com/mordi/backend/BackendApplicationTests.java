package com.mordi.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.junit.jupiter.api.Disabled;

@Disabled("Needs a real DB/Redis connection to boot the Spring context. " +
    "Re-enable once Testcontainers is wired up (see mordi-context.md, Tier 1: Testing).")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
