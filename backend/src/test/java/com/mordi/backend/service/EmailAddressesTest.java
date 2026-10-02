package com.mordi.backend.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailAddressesTest {

    @Test
    void trimsAndLowercases() {
        assertThat(EmailAddresses.normalize("  Ana.Lima@Example.COM ")).isEqualTo("ana.lima@example.com");
        assertThat(EmailAddresses.normalize("plain@example.com")).isEqualTo("plain@example.com");
    }

    @Test
    void nothingStaysNothing() {
        assertThat(EmailAddresses.normalize(null)).isNull();
        assertThat(EmailAddresses.normalize("   ")).isEmpty();
    }
}
