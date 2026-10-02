import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import { GOOGLE_MAPS_TERMS, GOOGLE_PRIVACY, LEGAL } from '../lib/legal';

export default function Terms() {
  const mail = <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>;

  return (
    <LegalPage
      title="Terms of Service"
      summary={
        <>
          <h2>In short</h2>
          <ul>
            <li>Mordi is free, run by one person, and offered as it is.</li>
            <li>What you put in stays yours. Be decent to the people you share goals with.</li>
            <li>You can leave at any time by deleting your account in Settings.</li>
          </ul>
        </>
      }
    >
      <h2>1. Agreeing to these Terms</h2>
      <p>
        Mordi ({LEGAL.site}) is run by {LEGAL.operator}, an individual in {LEGAL.state} (&ldquo;we&rdquo;). By
        creating an account or using Mordi, you agree to these Terms and to the{' '}
        <Link to="/privacy">Privacy Policy</Link>. If you do not agree, please do not use Mordi.
      </p>

      <h2>2. Who can use Mordi</h2>
      <p>
        You must be at least {LEGAL.minimumAge} years old. If you are under 18, you need the permission of a
        parent or guardian, who agrees to these Terms on your behalf. Each account is for one person, and you
        must give an email address that is yours.
      </p>

      <h2>3. Your account</h2>
      <p>
        Keep your password to yourself. You are responsible for what happens under your account, so tell us at{' '}
        {mail} if you think someone else has got into it.
      </p>

      <h2>4. Your content</h2>
      <p>
        Your goals, entries, notes and messages remain yours. You give us permission to store, process and show
        them only as needed to run Mordi for you, including showing your name, the days you marked a shared goal
        done, and your messages to the members of goals you share. That permission ends when you delete the
        content or your account. Copies in backups are overwritten within 7 days.
      </p>

      <h2>5. Shared goals and messages</h2>
      <p>
        Treat the people you share goals with decently. Do not use Mordi to harass or threaten anyone, to
        impersonate someone, to send spam, or to share anything illegal, sexually explicit, or that infringes
        someone else&rsquo;s rights. Members can leave a goal and owners can remove members. We may remove
        content, or suspend accounts, that break these rules.
      </p>

      <h2>6. Using Mordi fairly</h2>
      <p>
        Do not try to break, overload or get around Mordi&rsquo;s security; access other people&rsquo;s accounts;
        scrape it or create accounts automatically; or use it for anything unlawful.
      </p>

      <h2>7. Not medical advice</h2>
      <p>
        Mordi helps you track goals and the moods you choose to log. It does not give medical, psychological or
        other professional advice. If you are struggling, please talk to a professional. In the US you can call
        or text 988 at any time, and in an emergency, call 911.
      </p>

      <h2>8. Other services</h2>
      <p>
        Maps, places and routes come from Google. By using Mordi&rsquo;s map features you agree to the{' '}
        <a href={GOOGLE_MAPS_TERMS} target="_blank" rel="noopener noreferrer">
          Google Maps/Google Earth Additional Terms of Service
        </a>{' '}
        and the{' '}
        <a href={GOOGLE_PRIVACY} target="_blank" rel="noopener noreferrer">
          Google Privacy Policy
        </a>
        . Weather comes from Open-Meteo. We are not responsible for services we do not run.
      </p>

      <h2>9. Price, and changes to Mordi</h2>
      <p>
        Mordi is free. We may add, change or remove features, or stop running Mordi altogether. If we shut it
        down, we will give you at least 30 days&rsquo; notice where we can, so you have time to download your
        data.
      </p>

      <h2>10. Ending your use</h2>
      <p>
        You can delete your account at any time in Settings. We may suspend or delete an account that breaks
        these Terms or puts others at risk, and we will tell you why when we can.
      </p>

      <h2>11. No warranty</h2>
      <p>
        Mordi is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind,
        express or implied, including merchantability, fitness for a particular purpose and non-infringement.
        We do not promise that Mordi will always be available, free of errors, or that data will never be lost,
        so keep your own copy of anything that matters to you.
      </p>

      <h2>12. Limits on liability</h2>
      <p>
        To the fullest extent the law allows, {LEGAL.operator} is not liable for any indirect, incidental,
        special, consequential or punitive damages, or for lost data, profits or goodwill, arising from your use
        of Mordi. Our total liability for any claim about Mordi is limited to US$50. Some places do not allow
        these limits; where that is so, they apply only as far as the law permits.
      </p>

      <h2>13. If someone else makes a claim</h2>
      <p>
        If you break these Terms or the law while using Mordi, and someone brings a claim against us because of
        it, you agree to cover the reasonable costs of that claim.
      </p>

      <h2>14. Law and disputes</h2>
      <p>
        These Terms are governed by the laws of the State of {LEGAL.state}, without regard to its rules on
        conflicts of law. Before going to court, please write to {mail} so we can try to sort it out together.
        Any dispute that cannot be resolved will be heard in the state or federal courts located in{' '}
        {LEGAL.state}, and you and we agree to their jurisdiction.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        When these Terms change, the date at the top changes too. For significant changes, we will tell you in the
        app or by email at least 14 days before they take effect. If you keep using Mordi after that, you accept
        the new Terms; if you do not, you can delete your account.
      </p>

      <h2>16. The rest</h2>
      <p>
        These Terms and the Privacy Policy are the whole agreement between you and us about Mordi. If any part of
        them cannot be enforced, the rest still applies. Not enforcing a term straight away does not mean we have
        given it up. You may not transfer your account to anyone else.
      </p>

      <h2>17. Contact</h2>
      <p>
        {LEGAL.operator}, {LEGAL.state}. Email {mail}.
      </p>
    </LegalPage>
  );
}
