package com.mordi.backend.mail;

import java.time.Duration;

/**
 * The messages Mordi sends about an account. Plain text first, because that
 * is what every client shows; the HTML is the same words, with a button where
 * there is something to press. Matte like the rest of the product: no images,
 * no gradients.
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

        String html = page(
            paragraph(escape(greeting(name)))
            + paragraph("Someone asked to reset the password for your Mordi account. If that was you, "
                + "choose a new one here. The link works for " + minutes + ", and only once.")
            + button(link, "Reset my password")
            + quiet("If it wasn't you, ignore this email. Your password stays as it is.")
            + """
                <p style="margin:0;font-size:13px;line-height:1.5;color:#6b665e;word-break:break-all;">\
                Or paste this into your browser:<br>%s</p>
                """.formatted(escape(link)));

        return new Email(to, "Reset your Mordi password", text, html);
    }

    public static Email accountDeleted(String to, String name, String contact) {
        String text = """
            %s

            Your Mordi account has been deleted, as you asked, along with \
            everything in it: goals, entries, places, notes, to-dos, events and \
            messages. Goals you shared now belong to the person who joined them \
            first.

            Copies in our nightly backups are overwritten within 7 days. Nothing \
            else is kept.

            If you didn't ask for this, write to %s straight away.

            Mordi
            """.formatted(greeting(name), contact);

        String html = page(
            paragraph(escape(greeting(name)))
            + paragraph("Your Mordi account has been deleted, as you asked, along with everything in it: "
                + "goals, entries, places, notes, to-dos, events and messages. Goals you shared now belong "
                + "to the person who joined them first.")
            + paragraph("Copies in our nightly backups are overwritten within 7 days. Nothing else is kept.")
            + quiet("If you didn't ask for this, write to " + escape(contact) + " straight away."));

        return new Email(to, "Your Mordi account has been deleted", text, html);
    }

    static String greeting(String name) {
        String first = name == null ? "" : name.trim();
        return first.isEmpty() ? "Hi," : "Hi " + first + ",";
    }

    private static String page(String body) {
        return """
            <!doctype html>
            <html><body style="margin:0;padding:32px 16px;background:#f4f1ea;color:#1f1d1a;\
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:480px;margin:0 auto;padding:28px;background:#ffffff;\
            border:1px solid #e2ddd3;border-radius:12px;">
            <p style="margin:0 0 20px;font-size:20px;font-weight:600;">Mordi</p>
            %s</div></body></html>
            """.formatted(body);
    }

    private static String paragraph(String html) {
        return "<p style=\"margin:0 0 14px;font-size:16px;line-height:1.5;\">" + html + "</p>\n";
    }

    private static String quiet(String html) {
        return "<p style=\"margin:0 0 14px;font-size:14px;line-height:1.5;color:#6b665e;\">" + html + "</p>\n";
    }

    private static String button(String href, String label) {
        return "<p style=\"margin:24px 0;\"><a href=\"" + escape(href) + "\" style=\"display:inline-block;"
            + "padding:12px 20px;background:#1f1d1a;color:#ffffff;text-decoration:none;border-radius:8px;"
            + "font-weight:600;\">" + escape(label) + "</a></p>\n";
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
