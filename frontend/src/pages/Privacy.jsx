import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import { GOOGLE_PRIVACY, LEGAL } from '../lib/legal';

/**
 * Written from what the code actually stores and sends, not from a template.
 * When a feature starts collecting something new or calling a new service,
 * this page changes with it, and LEGAL.version is bumped.
 */
export default function Privacy() {
  const mail = <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>;

  return (
    <LegalPage
      title="Privacy Policy"
      summary={
        <>
          <h2>In short</h2>
          <ul>
            <li>Mordi keeps what you put into it so it can show it back to you. That is all it is for.</li>
            <li>No ads, no tracking across other sites, and your data is never sold or shared for advertising.</li>
            <li>You can delete your account from Settings at any time, and everything in it goes at once.</li>
          </ul>
        </>
      }
    >
      <p>
        Mordi ({LEGAL.site}) is a goal and habit tracker run by {LEGAL.operator}, in {LEGAL.state}. This
        policy says what Mordi collects, why, who else sees any of it, and what you can do about it.
        &ldquo;We&rdquo; means Mordi and the person who runs it.
      </p>

      <h2>What we collect</h2>
      <h3>Your account</h3>
      <p>
        Your name, your email address and your password, which is stored only as a one-way hash we cannot
        read back. We also note when you signed up and which version of the Terms you agreed to.
      </p>

      <h3>What you add</h3>
      <p>
        Goals, entries (the note, your mood, whether it was done, the day and time, and how long a timed
        session ran), notes, to-dos, calendar events, including any you import from a calendar file, and
        the weekly summaries Mordi works out from them.
      </p>

      <h3>Location, only when you ask</h3>
      <p>
        When you attach a place to an entry, save a place, plan a trip or show the weather, your browser
        asks your permission and then shares your device&rsquo;s position. We store the coordinates,
        rounded to about 10 metres, and the place name with what you saved. Mordi never follows your
        location in the background, and it works without location if you say no.
      </p>

      <h3>Shared goals</h3>
      <p>
        When you join or share a goal, the other members see your name, which days you marked that goal
        done, and the messages you write in its thread. They never see your notes, moods or places.
      </p>

      <h3>Reminders</h3>
      <p>
        If you turn reminders on: your time zone, the hour you picked, and the push subscription your browser
        gives us, which is an address at your browser maker&rsquo;s push service plus the keys to encrypt
        messages for it.
      </p>

      <h3>Technical records</h3>
      <p>
        Like most websites, our web server keeps access logs: your IP address, the time, the page or API
        address requested and your browser type. We use them for security and to fix problems. Your IP
        address is also held for about a minute to limit repeated sign-in and password attempts.
      </p>

      <h3>On your device</h3>
      <p>
        Mordi keeps you signed in with one cookie, <code>mordi_refresh</code>, which lasts up to 30 days, and
        keeps your sign-in, color theme and layout choices in your browser&rsquo;s storage. There are no
        advertising or analytics cookies, and nothing that follows you to other sites.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To run Mordi for you: show your week, keep your devices in step, send the reminders you asked for, and carry messages in shared goals.</li>
        <li>To send account email: password reset links, and confirmation when an account is deleted. No newsletters or marketing.</li>
        <li>To keep Mordi secure and working: stop abuse, limit repeated attempts and fix bugs.</li>
      </ul>
      <p>
        We do not sell your personal information or share it for targeted advertising, and we do not use it
        to train AI models. Your location is used only for the feature you asked for at the time.
      </p>

      <h2>Who else handles it</h2>
      <p>
        A few services do part of the work. Each gets only what its job needs and handles it under its own
        privacy policy.
      </p>
      <dl className="legal__services">
        <div>
          <dt>Oracle Cloud</dt>
          <dd>Hosts Mordi&rsquo;s server and database, so it holds everything above.</dd>
        </div>
        <div>
          <dt>Resend</dt>
          <dd>Delivers account email: your address, your name and the message.</dd>
        </div>
        <div>
          <dt>Google Maps Platform</dt>
          <dd>
            Draws maps, looks up places and addresses, and plans trips: the coordinates and searches involved,
            and your IP address. Mordi uses Google Maps features and content, and your use of them is subject
            to the <a href={GOOGLE_PRIVACY} target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
          </dd>
        </div>
        <div>
          <dt>Google Fonts</dt>
          <dd>Serves the typefaces: your IP address and browser type when they load.</dd>
        </div>
        <div>
          <dt>Open-Meteo</dt>
          <dd>Provides the weather: rounded coordinates only, with no account and no cookies.</dd>
        </div>
        <div>
          <dt>Your browser&rsquo;s push service</dt>
          <dd>
            Google, Mozilla, Apple or Microsoft, depending on your browser, delivers reminders. The message
            is encrypted so the push service cannot read it.
          </dd>
        </div>
      </dl>
      <p>
        We may also disclose information when the law requires it, or to protect someone&rsquo;s safety.
        If Mordi ever changes hands, this policy goes with your data, and you will be told before it does.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your data is kept for as long as you have an account.</li>
        <li>
          When you delete your account, everything in it is deleted straight away. Nightly backups are kept
          for 7 days and then overwritten, so it is gone from those within a week.
        </li>
        <li>Web server logs are kept for about two weeks.</li>
        <li>Password reset links stop working after 30 minutes, and sign-in sessions end after 30 days.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>See and download your data.</strong> In <Link to="/settings">Settings</Link>, &ldquo;Download
          my data&rdquo; saves your goals, entries and places. For a copy of everything else, write to {mail}.
        </li>
        <li><strong>Correct it.</strong> Edit anything in the app. To change your name or email address, write to us.</li>
        <li><strong>Delete it.</strong> Settings, then Delete account. It takes effect at once.</li>
        <li><strong>Location and reminders.</strong> Refuse or withdraw location permission in your browser, and turn reminders off in Settings, whenever you like.</li>
      </ul>
      <p>
        <strong>California residents</strong> have the right to know what personal information we collect, use
        and disclose; to have it deleted or corrected; and not to be treated differently for asking. We do not
        sell or share personal information as California law defines those terms, and we use precise location
        only to provide what you asked for. We honor these rights for everyone, wherever they live.
      </p>
      <p>
        Write to {mail} for any of this and we will answer within 30 days. We may first ask you to confirm the
        request from the email address on the account.
      </p>
      <p>
        Because Mordi does not track you across other sites or let anyone else do so, it works the same whether
        or not your browser sends a Do Not Track or Global Privacy Control signal.
      </p>

      <h2>Security</h2>
      <p>
        Everything travels over HTTPS. Passwords are stored as one-way hashes, and sign-in and reset tokens are
        stored only as hashes too. Only the person who runs Mordi can reach the server. No system is perfectly
        secure; if a breach affects your data, we will tell you as the law requires.
      </p>

      <h2>Children</h2>
      <p>
        Mordi is not meant for children under {LEGAL.minimumAge}, and we do not knowingly collect their
        information. If you think a child under {LEGAL.minimumAge} has an account, write to {mail} and we will
        delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        When this policy changes, the date at the top changes too. If a change is significant, we will tell you
        in the app or by email before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.operator}, {LEGAL.state}. Email {mail}.
      </p>
    </LegalPage>
  );
}
