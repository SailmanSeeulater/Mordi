import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import { LEGAL } from '../lib/legal';

/**
 * What Mordi is, on one screen. Every claim here is one the app already makes
 * for itself (PRODUCT.md) or one the Terms and Privacy Policy make (lib/legal.js);
 * nothing is promised that the app does not do.
 */
export default function About() {
  const mail = <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>;

  return (
    <LegalPage title="About Mordi" documentTitle="About" meta="Free, and run by one person.">
      <p>
        Mordi tracks goals with a weekly target and the entries you log against them, so you can see at a
        glance whether the week is on track. It is for people building everyday routines: habits, recurring
        tasks, study or fitness goals.
      </p>

      <h2>How it works</h2>
      <p>
        A goal carries a target of one to seven times a week, and every entry you log belongs to a day. The
        week is the unit: each screen answers where the week stands before anything else. Progress is
        measured against the target you set, never against a streak the app invented, and a day with nothing
        logged counts as missed only for goals meant to happen daily, or on days you planned a goal for.
      </p>

      <h2>What it doesn&rsquo;t do</h2>
      <p>
        No ads, no tracking across other sites, and your data is never sold or shared for advertising. No
        newsletters or marketing email. Mordi says only what your records support: no invented goals, streak
        rules or trend claims.
      </p>

      <h2>Your data</h2>
      <p>
        What you put in stays yours. In <Link to="/settings">Settings</Link> you can download your goals,
        entries and places as one file, and delete your account, which removes everything in it at once. The{' '}
        <Link to="/privacy">Privacy Policy</Link> says exactly what is stored and who else handles any of it.
      </p>

      <h2>Who runs it</h2>
      <p>
        {LEGAL.operator}, in {LEGAL.state}. Mordi is free and offered as it is; the{' '}
        <Link to="/terms">Terms of Service</Link> have the details. Questions go to {mail}.
      </p>
    </LegalPage>
  );
}
