package com.mordi.backend.mail;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** The request as Resend will see it, without reaching Resend. */
class ResendMailerTest {

    private static final String FROM = "Mordi <hello@latesailor.dev>";

    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = mock(HttpClient.class);
    private final Email email = new Email("ana@example.com", "Reset your Mordi password", "plain words", "<p>html</p>");

    @SuppressWarnings("unchecked")
    private void resendAnswers(int status, String body) throws IOException, InterruptedException {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
    }

    @Test
    void withoutAKeyNothingIsSentAndNothingFails() {
        ResendMailer mailer = new ResendMailer("", FROM, json, http);

        assertThat(mailer.enabled()).isFalse();
        assertThat(mailer.deliver(email)).isEqualTo(ResendMailer.Result.SKIPPED);
        verifyNoInteractions(http);
    }

    @Test
    void theBodyUsesResendsFieldNames() throws Exception {
        JsonNode body = json.readTree(new ResendMailer("re_test", FROM, json, http).body(email));

        assertThat(body.get("from").asText()).isEqualTo(FROM);
        assertThat(body.get("to").asText()).isEqualTo("ana@example.com");
        assertThat(body.get("subject").asText()).isEqualTo("Reset your Mordi password");
        assertThat(body.get("text").asText()).isEqualTo("plain words");
        assertThat(body.get("html").asText()).isEqualTo("<p>html</p>");
    }

    @Test
    void aTextOnlyMessageCarriesNoHtmlField() throws Exception {
        Email plain = new Email("ana@example.com", "Hello", "plain words", null);

        JsonNode body = json.readTree(new ResendMailer("re_test", FROM, json, http).body(plain));

        assertThat(body.has("html")).isFalse();
    }

    @Test
    void postsToResendWithTheKeyAsABearerToken() throws Exception {
        resendAnswers(200, "{\"id\":\"abc\"}");
        ResendMailer mailer = new ResendMailer("re_test", FROM, json, http);

        assertThat(mailer.deliver(email)).isEqualTo(ResendMailer.Result.SENT);

        ArgumentCaptor<HttpRequest> sent = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(sent.capture(), any());
        HttpRequest request = sent.getValue();
        assertThat(request.uri()).isEqualTo(ResendMailer.ENDPOINT);
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.headers().firstValue("Authorization")).contains("Bearer re_test");
        assertThat(request.headers().firstValue("Content-Type")).contains("application/json");
    }

    @Test
    void aRejectedMessageIsReportedAsFailedNotThrown() throws Exception {
        resendAnswers(422, "{\"message\":\"domain not verified\"}");

        assertThat(new ResendMailer("re_test", FROM, json, http).deliver(email))
            .isEqualTo(ResendMailer.Result.FAILED);
    }

    @Test
    @SuppressWarnings("unchecked")
    void anUnreachableResendIsReportedAsFailedNotThrown() throws Exception {
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("connection refused"));

        assertThat(new ResendMailer("re_test", FROM, json, http).deliver(email))
            .isEqualTo(ResendMailer.Result.FAILED);
    }
}
