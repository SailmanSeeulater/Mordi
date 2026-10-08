/**
 * Every word on the landing page, in page order, so the copy can be read and
 * edited in one place without touching the layout.
 *
 * Rule for this file: say only what the app does today. No testimonials, no
 * user counts, no claims the code cannot back. Any figure inside a demo is
 * illustrative and the page labels it so (see PRODUCT.md, "Evidence on Hand").
 */

export const NAV = {
  links: [
    { href: '#how', label: 'How it works' },
    { href: '#report', label: 'Weekly report' },
    { href: '#reminders', label: 'Reminders' },
    { href: '#together', label: 'Together' },
    { href: '#faq', label: 'Questions' },
  ],
  signIn: 'Sign in',
  signUp: 'Sign up',
};

export const HERO = {
  title: 'Goals you set. A week that keeps count.',
  sub:
    'Give each goal a number of days a week, then log it in one tap. Mordi measures your week against that number, not against a streak it made up.',
  primary: 'Create an account',
  secondary: 'See how it works',
  note: 'Illustrative example. A new account starts empty and fills as you log.',
};

export const HOW = {
  title: 'How it works',
  sub: 'Three things to learn, then it’s just your week.',
  pause: 'Pause',
  play: 'Play',
  steps: [
    {
      id: 'target',
      title: 'Set a weekly target',
      body:
        'Name a goal and pick how many days a week it should happen, from 1 to 7. Four runs a week and a daily read are different goals, and Mordi counts them differently.',
    },
    {
      id: 'log',
      title: 'Log it in one tap',
      body:
        'Tap Log today, choose how it felt, and add a note if you want one. That’s the whole entry.',
    },
    {
      id: 'week',
      title: 'See where the week stands',
      body:
        'The week card tells you whether you’re on pace for today. An empty day counts as missed only for a goal meant to happen every day.',
    },
  ],
};

export const REPORT = {
  title: 'Every week, written up',
  body:
    'A sentence on how the week went against what you planned, then each goal day by day, entries against last week, your mood mix, and the to-dos you finished.',
  aside: 'Every chart has a data table behind it for screen readers.',
};

export const REMINDERS = {
  title: 'Open it, and you know what’s left',
  body:
    'Every time you open your dashboard, the week card says what still needs doing this week, most pressing first. When every target is met, the line goes away.',
  points: [
    'Only facts against targets you set. No streaks, no scolding.',
    'Nothing once the week is done.',
    'Want it without opening the app? Turn on reminders in Settings and the same line arrives as a notification, once a day at an hour you choose.',
  ],
};

export const TODOS = {
  title: 'Finished to-dos count too',
  body:
    'Tick one off and it’s kept with the day you did it. It shows in Lately beside your entries and in that week’s report, without touching your goal percentages.',
  aside: 'Clear done tidies the list. The record stays.',
};

export const TOGETHER = {
  title: 'Share a goal, not your diary',
  body:
    'Invite up to eight people with a link that expires in seven days. Each person logs the goal themselves, and every shared goal has one thread.',
  points: [
    'Members see names and which days each person marked it done.',
    'Never your notes, moods or places.',
    'Invite links can be revoked at any time.',
  ],
};

export const FOCUSED = {
  title: 'Starts small. Grows with you.',
  body:
    'A new account shows your goals, the week card and what you logged. Everything else is a switch in Settings, and some parts turn on by themselves once there’s something to show.',
};

export const MORE = {
  title: 'And when you want more',
  items: [
    {
      id: 'timer',
      title: 'Timer',
      body: 'Time a session, then save it as an entry. It survives a reload or a sleeping tab.',
    },
    {
      id: 'calendar',
      title: 'Calendar',
      body: 'Day, week and month. Drag to block out time, and import .ics files from Google, Apple or Outlook.',
    },
    {
      id: 'notes',
      title: 'Notes',
      body: 'Up to five Markdown notes, with [[links]], #tags and task lists.',
    },
    {
      id: 'activity',
      title: 'Activity',
      body: 'A year of logging, one square a day.',
    },
    {
      id: 'history',
      title: 'History',
      body: 'Archive a goal when you’re done with it. History keeps what it came to, and you can bring it back.',
    },
    {
      id: 'places',
      title: 'Places',
      body: 'Save places on a map, attach them to goals and entries, and get directions.',
    },
  ],
};

export const THEMES_COPY = {
  title: 'Twenty-six color combinations',
  body: 'Sixteen light, ten dark. Pick one here and the whole site follows, this page included.',
};

export const DATA = {
  title: 'Your data stays yours',
  points: [
    {
      title: 'Take it with you',
      body: 'Download your goals, entries and places as a JSON file from Settings.',
    },
    {
      title: 'Leave cleanly',
      body:
        'Delete your account and it’s gone at once: goals, entries, places, notes, to-dos and messages. Nightly backups roll over within seven days.',
    },
    {
      title: 'Read what’s kept',
      body: 'The Privacy Policy is written from what the app actually stores and the services it calls.',
    },
  ],
};

export const FAQ = {
  title: 'Questions',
  items: [
    {
      q: 'Is there a phone app?',
      a: 'Mordi is a web app. It works in the browser on phones and computers, and keeps you signed in from one day to the next.',
    },
    {
      q: 'What counts as a missed day?',
      a: 'Only an empty day for a goal set to every day. A goal set to four times a week has room for days off, and Mordi doesn’t count them against you.',
    },
    {
      q: 'Can I log something that isn’t a goal?',
      a: 'Yes. An entry can stand on its own, with a mood, a note and a place, or be attached to one goal.',
    },
    {
      q: 'Will it send me notifications?',
      a: 'Only if you turn reminders on: one push a day at the hour you pick, and only when a goal still has days left that week.',
    },
    {
      q: 'Who can see my entries?',
      a: 'Only you. On a shared goal, other members see your name and which days you marked it done, never your notes, moods or places.',
    },
    {
      q: 'How do I delete my account?',
      a: 'From Settings, with your password. It happens immediately, and a confirmation email follows.',
    },
  ],
};

export const CLOSE = {
  title: 'Start with one goal.',
  sub: 'Pick a number of days. Log the first one today.',
  cta: 'Create an account',
};

export const FOOTER = {
  product: 'Product',
  legal: 'Legal',
  account: 'Account',
  copyright: '© 2026 Mordi.',
};

/* Illustrative data for the demos. Labeled on the page as an example. */

// One week, Thursday is today. Targets sum to 13, so on Thursday the pace is
// round(13 × 4 / 7) = 7: the same rule the dashboard uses (dashboardData.js).
export const DEMO_GOALS = [
  { id: 'run', title: 'Morning run', target: 4 },
  { id: 'read', title: 'Read before bed', target: 7 },
  { id: 'stretch', title: 'Stretch', target: 2 },
];

// Small words inside the demos.
export const DEMO_TEXT = {
  illustrative: 'Illustrative example',
  replay: 'Replay',
  weekCardLabel: 'Example week card',
  daysLabel: 'Entries per day, Monday to Sunday',
  latelyLabel: 'Example of the Lately feed',
  latelyEmpty: 'Nothing logged yet today',
  heroLately: [
    { note: 'Easy 5k by the river', goal: 'Morning run', mood: 'Good' },
    { note: 'Two chapters', goal: 'Read before bed', mood: 'Great' },
  ],
  ruleRest: 'Tuesday was empty. For a 4×-a-week goal that’s a rest day, not a miss.',
  ruleMissed: 'Wednesday was empty. For a daily goal, that one counts as missed.',
  reportGrid: 'Each goal, day by day',
  reportBars: 'Entries per day',
  reportMood: 'Mood mix',
  // The reminder's real wording (ReminderComposer.java), for Thursday of the
  // example week. Largest share still to do comes first, as the composer sorts it.
  pushTitle: '4 days left this week',
  pushBody: 'Morning run: 3 of 4 left · Read before bed: 4 of 7 left',
  remindThu: 'Thursday',
  remindSun: 'Sunday',
  remindQuiet: 'Every target met. Nothing to say.',
};

export const DEMO_THREAD = [
  { who: 'AK', text: 'Out early tomorrow if anyone wants to join.' },
  { who: 'You', text: 'I’ll be there.' },
];
