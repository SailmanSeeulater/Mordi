package com.mordi.backend.mail;

import com.mordi.backend.service.AccountService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The goodbye email, sent only once the deletion has actually committed: a
 * rolled-back deletion must not tell anyone their account is gone.
 */
@Component
public class AccountMail {

    private final ResendMailer mailer;
    private final String contact;

    public AccountMail(ResendMailer mailer, @Value("${mordi.legal.contact:privacy@latesailor.dev}") String contact) {
        this.mailer = mailer;
        this.contact = contact;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccountDeleted(AccountService.AccountDeleted event) {
        mailer.send(AccountEmails.accountDeleted(event.email(), event.name(), contact));
    }
}
