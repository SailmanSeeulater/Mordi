import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import { LEGAL } from '../lib/legal';

const SUMMARY = [
  'Mordi is free to use, and it is provided as is.',
  'What you put in stays yours. We only use it to run Mordi for you.',
  'Be decent in shared goals: no harassment, spam or illegal content.',
  'Mordi helps you keep track. It is not medical, health or professional advice.',
  'You can stop using Mordi at any time. We may suspend accounts that break these terms.',
];

const SECTIONS = [
  {
    id: 'agree',
    title: 'Using Mordi',
    body: (
      <p>
        These terms are an agreement between you and {LEGAL.operator}, who runs Mordi. By creating an account or using
        Mordi, you agree to them and to the <Link to="/privacy">Privacy page</Link>, which explains what happens to
        your data. If you don&rsquo;t agree, please don&rsquo;t use Mordi.
      </p>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>You need to be at least {LEGAL.minimumAge} years old to use Mordi.</li>
        <li>Use your real email address, so you can be reached about your account.</li>
        <li>An account is for one person. Keep your password to yourself.</li>
        <li>
          You are responsible for what happens under your account. If you think someone else has got in, change your
          password and tell us.
        </li>
      </ul>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <p>
        Everything you put into Mordi, including goals, entries, notes, events and messages, remains yours. You give us
        permission to store it, process it and show it back to you, and to show it to the people you choose to share
        with, only as needed to run Mordi. That permission ends when you delete the content or your account, except for
        backup copies, which are overwritten in the normal course of things.
      </p>
    ),
  },
  {
    id: 'shared',
    title: 'Shared goals and messages',
    body: (
      <>
        <p>
          When you share a goal or join one, the people in it see your name, which days you marked it done, and what
          you post in its thread. In shared goals and their threads, don&rsquo;t:
        </p>
        <ul>
          <li>harass, threaten, demean or impersonate anyone;</li>
          <li>post spam, advertising or anything illegal;</li>
          <li>share someone else&rsquo;s private information without their permission.</li>
        </ul>
        <p>
          A goal&rsquo;s owner can remove messages and people from their goal, and anyone can leave a shared goal at
          any time. To report something, email <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a> with the goal
          and what happened. We will look at every report and may remove content or suspend accounts.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'Acceptable use',
    body: (
      <>
        <p>Don&rsquo;t:</p>
        <ul>
          <li>try to get into accounts or data that aren&rsquo;t yours;</li>
          <li>disrupt or overload Mordi, or get around its limits;</li>
          <li>create accounts or send requests by automated means, or scrape the service;</li>
          <li>use Mordi to break the law.</li>
        </ul>
        <p>
          If you find a security problem, please tell us privately at{' '}
          <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a> instead of testing it on other people&rsquo;s
          accounts.
        </p>
      </>
    ),
  },
  {
    id: 'advice',
    title: 'Not professional advice',
    body: (
      <p>
        Mordi counts what you do against targets you set. Its reports, suggestions and summaries describe your own
        records. They are not medical, health, fitness, psychological or other professional advice. Talk to a qualified
        professional about those things.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'The service',
    body: (
      <p>
        Mordi is free. It is run by one person, and it will change: features may be added, changed or removed, and
        there may be downtime. We do our best to keep your data safe and the service running, but we can&rsquo;t
        promise it will always be available or free of errors. Keep your own copy of anything important. Settings lets
        you download your data at any time.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your use',
    body: (
      <p>
        You can stop using Mordi at any time and ask us to delete your account, as the{' '}
        <Link to="/privacy#keep">Privacy page</Link> explains. We may suspend or close an account that breaks these
        terms or puts other people or the service at risk. Where it is reasonable, we will tell you first and give you
        the chance to download your data.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Disclaimers and liability',
    body: (
      <>
        <p>
          Mordi is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, to
          the extent the law allows.
        </p>
        <p>
          To the extent the law allows, we are not liable for indirect or consequential losses, or for lost data or
          profits, arising from your use of Mordi. Because Mordi is free, our total liability to you for any claim is
          limited to US$50. Nothing in these terms limits liability that cannot be limited by law, or takes away rights
          you have as a consumer where you live.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        If we change these terms, we will update the date at the top. For changes that matter, we will tell you in the
        app before they take effect. If you keep using Mordi after a change, you accept the new terms.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of {LEGAL.governingLaw}, except where the law where you live gives you the
        right to rely on your local laws and courts.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      summary={SUMMARY}
      sections={SECTIONS}
      other={{ to: '/privacy', label: 'Privacy' }}
    />
  );
}
