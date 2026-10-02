package com.mordi.backend.mail;

import java.time.Duration;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AccountEmailsTest {

    private static final String LINK = "https://mordi.test/reset-password#abc_DEF-123";

    @Test
    void theLinkAndTheTimeLimitAreInBothForms() {
        Email email = AccountEmails.passwordReset("ana@example.com", "Ana", LINK, Duration.ofMinutes(30));

        assertThat(email.to()).isEqualTo("ana@example.com");
        assertThat(email.subject()).containsIgnoringCase("password");
        assertThat(email.text()).startsWith("Hi Ana,").contains(LINK).contains("30 minutes");
        assertThat(email.html()).contains("href=\"" + LINK + "\"").contains("Hi Ana,").contains("30 minutes");
    }

    @Test
    void aNameIsShownInTheHtmlNeverRunAsIt() {
        Email email = AccountEmails.passwordReset("ana@example.com", "<b>Ana</b> & co", LINK, Duration.ofMinutes(30));

        assertThat(email.html()).contains("&lt;b&gt;Ana&lt;/b&gt; &amp; co").doesNotContain("<b>Ana");
        // Plain text is not HTML; the name goes in as typed.
        assertThat(email.text()).contains("Hi <b>Ana</b> & co,");
    }

    @Test
    void noNameStillReadsAsAGreeting() {
        assertThat(AccountEmails.passwordReset("a@b.c", "", LINK, Duration.ofMinutes(30)).text()).startsWith("Hi,");
        assertThat(AccountEmails.passwordReset("a@b.c", null, LINK, Duration.ofMinutes(30)).text()).startsWith("Hi,");
        assertThat(AccountEmails.passwordReset("a@b.c", "  Jo  ", LINK, Duration.ofMinutes(30)).text()).startsWith("Hi Jo,");
    }
}
