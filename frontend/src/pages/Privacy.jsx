import LegalPage from '../components/LegalPage';
import { LEGAL } from '../lib/legal';

/*
 * Written from what the app actually does, not from a template. When the
 * app changes what it stores or who it talks to, this page changes with it,
 * along with LEGAL.updated.
 */

const SUMMARY = [
  'We keep what you put into Mordi so we can show it back to you. That is the whole business.',
  'No ads, no selling your data, no analytics or tracking scripts, no third-party cookies.',
  'In a shared goal, the other people see your name, which days you marked it done, and the messages you post. Never your notes, moods or places.',
  'Your location is only read when you ask for it.',
  'You can download your goals, entries and places from Settings at any time, and ask us to delete your account.',
];

const SECTIONS = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <p>
        Mordi is a goal tracker run by {LEGAL.operator}. &ldquo;We&rdquo; on this page means Mordi and the person
        running it. You can reach us at <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>.
      </p>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <h3>Your account</h3>
        <p>
          Your name, your email address and your password. The password is never stored as you typed it: we keep
          only a bcrypt hash of it, which cannot be turned back into the password.
        </p>
        <h3>What you put in</h3>
        <ul>
          <li>Goals: title, category, weekly target, usual place, and when you archive one.</li>
          <li>
            Entries: the note, mood, whether it was done, the day and time you logged it, how long a timed session
            took, and a place name and coordinates if you added one.
          </li>
          <li>Notes, to-dos, calendar events (including any you import from a calendar file), and saved places.</li>
          <li>Weekly reports Mordi writes from your entries.</li>
        </ul>
        <h3>Shared goals</h3>
        <p>
          Which shared goals you are in, the messages you post in them, and invite links. For invite links we keep
          only a hash of the code, not the code itself.
        </p>
        <h3>Reminders</h3>
        <p>
          If you turn reminders on: your time zone, the hour you picked, and the push subscription your browser gives
          us (an address at your browser&rsquo;s push service and the keys to encrypt messages to it).
        </p>
        <h3>Technical information</h3>
        <p>
          Like any website, our server sees your IP address and browser details with each request, and records
          standard request logs. We use them only to keep Mordi running and secure.
        </p>
      </>
    ),
  },
  {
    id: 'not',
    title: 'What we don’t do',
    body: (
      <ul>
        <li>We don&rsquo;t sell your personal information, and we don&rsquo;t share it for advertising.</li>
        <li>We don&rsquo;t show ads.</li>
        <li>We don&rsquo;t run analytics or tracking scripts in the app, and we set no third-party cookies.</li>
        <li>We don&rsquo;t read your entries, notes or messages except when you ask us to help with a problem.</li>
      </ul>
    ),
  },
  {
    id: 'location',
    title: 'Your location',
    body: (
      <p>
        Mordi reads your location only when you ask it to: &ldquo;Use my location&rdquo; when logging, the Places map,
        and directions. Your browser asks your permission first. Coordinates are rounded to about ten metres. To show a
        place name instead of numbers, the rounded coordinates are sent to Google. They are stored only if you save
        them with an entry or a place. The last place you used is also remembered in your browser, so the weather on
        your dashboard knows where you are.
      </p>
    ),
  },
  {
    id: 'share',
    title: 'Who else sees your information',
    body: (
      <>
        <h3>People in a shared goal</h3>
        <p>
          When you join or share a goal, the other people in it see your name, which days you marked that goal done,
          and the messages you post in its thread. They never see your notes, moods, places or any of your other
          goals. The goal&rsquo;s owner can remove messages and people. Invite links work for anyone who has them
          until they expire or the owner turns them off, so share them only with people you mean to.
        </p>
        <h3>Services Mordi uses</h3>
        <ul>
          <li>
            <strong>Our hosting provider</strong> runs the server and database that store your data.
          </li>
          <li>
            <strong>Google Maps Platform</strong> draws the map, turns coordinates into place names, and works out
            directions. It receives the places and coordinates involved, and your IP address. Google&rsquo;s privacy
            policy applies to that data.
          </li>
          <li>
            <strong>Open-Meteo</strong> provides the weather on your dashboard. Your browser sends it the rounded
            coordinates of your last place. No account details are sent.
          </li>
          <li>
            <strong>Fontshare and Google Fonts</strong> serve Mordi&rsquo;s typefaces, so they see your IP address and
            browser when the page loads.
          </li>
          <li>
            <strong>Your browser&rsquo;s push service</strong> (from Google, Apple or Mozilla, depending on your
            browser) delivers reminders and message alerts. The content is encrypted to your browser, so the push
            service can see that a notification was sent but not what it says.
          </li>
        </ul>
        <h3>When the law requires it</h3>
        <p>
          We will disclose information if we are legally required to, and we will tell you about it where we are
          allowed to.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and browser storage',
    body: (
      <>
        <p>
          Mordi sets one cookie: the one that keeps you signed in. It lasts 30 days, is replaced every time it is used,
          can&rsquo;t be read by scripts on the page, and is only ever sent back to Mordi itself.
        </p>
        <p>
          Mordi also keeps a few things in your browser&rsquo;s local storage: a short-lived sign-in token (15
          minutes), your name and email for the top bar, and your preferences, such as colour theme, layout, the order
          of your goals, timer state, last place and cached weather. These stay on your device. Signing out clears the
          sign-in token.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <p>
        Everything travels over HTTPS. Passwords are stored as bcrypt hashes. Sign-in tokens are short-lived, and the
        long-lived one is replaced every time it is used, so an old copy can’t be reused. Invite codes are stored as hashes, and
        repeated sign-in attempts are rate limited. No system is perfectly secure. If we learn of a breach affecting
        your data, we will tell you promptly.
      </p>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep it, and deleting it',
    body: (
      <>
        <p>
          We keep your data for as long as you have an account, so Mordi can show you your history. Archived goals stay
          in History until you delete them. You can delete entries, notes, to-dos, events and messages yourself at any
          time.
        </p>
        <p>
          To delete your whole account, email <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a> from the
          address you signed up with. We will delete your account and everything in it within 30 days, and confirm when
          it is done. In-app account deletion is on the way. Messages you posted in shared goals are deleted with your
          account.
        </p>
        <p>
          You can download your goals, entries and saved places at any time from <strong>Settings &rarr; Your data</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          You can see, correct, download and delete your information. Most of this you can do in the app, and anything
          else we will do on request. Depending on where you live, for example in the EU, the UK or California, the law
          gives you further rights, such as objecting to how we use your data or complaining to a regulator. Email us
          and we will respond within 30 days.
        </p>
        <p>
          We don&rsquo;t sell personal information or share it for cross-context behavioural advertising, as those
          terms are defined under California law.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        Mordi is not meant for children under {LEGAL.minimumAge}, and we don&rsquo;t knowingly collect their
        information. If you believe a child has made an account, email us and we will delete it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this page',
    body: (
      <p>
        When Mordi starts collecting something new or using data in a new way, this page changes first, along with the
        date at the top. If a change matters to how your data is used, we will tell you in the app before it takes
        effect.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      summary={SUMMARY}
      sections={SECTIONS}
      other={{ to: '/terms', label: 'Terms of use' }}
    />
  );
}
