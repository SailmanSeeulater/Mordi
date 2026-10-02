package com.mordi.backend.mail;

import java.time.Duration;

/**
 * The messages Mordi sends about an account. Plain text first, because that
 * is what every client shows; the HTML is the same words with one button.
 * Matte like the rest of the product: no images, no gradients.
 */
public final class AccountEmails {

    private AccountEmails() {}

    public static Email passwordReset(String to, String name, String link, Duration validFor) {
        String minutes = validFor.toMinutes() + " minutes";
        String text = """
            %s

            Someone asked to reset the password for your Mordi account. If that \
            was you, open this link within %s to choose a new one:

            %s

            If it wasn't you, ignore this email. Your password stays as it is.

            Mordi
            """.formatted(greeting(name), minutes, link);

        String html = """
            <!doctype html>
            <html><body style="margin:0;padding:32px 16px;background:#f4f1ea;color:#1f1d1a;\
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:480px;margin:0 auto;padding:28px;background:#ffffff;\
            border:1px solid #e2ddd3;border-radius:12px;">
            <p style="margin:0 0 20px;font-size:20px;font-weight:600;">Mordi</p>
            <p style="margin:0 0 14px;font-size:16px;line-height:1.5;">%s</p>
            <p style="margin:0 0 14px;font-size:16px;line-height:1.5;">Someone asked to reset the password \
            for your Mordi account. If that was you, choose a new one here. The link works for %s, and only once.</p>
            <p style="margin:24px 0;"><a href="%s" style="display:inline-block;padding:12px 20px;\
            background:#1f1d1a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Reset my password</a></p>
            <p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#6b665e;">If it wasn't you, ignore this email. \
            Your password stays as it is.</p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#6b665e;word-break:break-all;">Or paste this into \
            your browser:<br>%s</p>
            </div></body></html>
            """.formatted(escape(greeting(name)), minutes, escape(link), escape(link));

        return new Email(to, "Reset your Mordi password", text, html);
    }

    static String greeting(String name) {
        String first = name == null ? "" : name.trim();
        return first.isEmpty() ? "Hi," : "Hi " + first + ",";
    }

    /** Names are typed by people; they are shown in the HTML, never run as it. */
    static String escape(String s) {
        StringBuilder out = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
