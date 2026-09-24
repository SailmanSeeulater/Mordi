# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People building and keeping everyday routines — habits, recurring tasks, and study or fitness goals — who have abandoned at least one task app before. They arrive as strangers, sign up themselves, and the app has to make sense on first run with no data in it. The daily use is short and repeated: open, see where the week stands, log one entry, leave.

## Product Purpose

Mordi tracks goals with a weekly target and the entries logged against them, so a person can see at a glance whether the week is on track. Success is a user who keeps logging past the first week, because the list maintains itself instead of asking to be maintained.

## Positioning

Goals carry a numeric weekly target (1–7 times per week), and every logged entry is attributed to a day. That pairing is what the product owns: progress is measured against a target the user set, not against a streak the app invented, and a day with nothing logged reads as missed only for goals meant to happen daily.

## Operating Context

- Web app, phone and desktop, used in short sessions at the edges of the day.
- Routes: landing (`/`), sign in and create account, dashboard (`/dashboard`), goals (`/goals`), locations (`/locations`), weekly report (`/reports`), settings (`/settings`).
- Auth is email plus password. A 15-minute access token is kept in `localStorage`; a 30-day refresh token, rotated on every use, lives in an httpOnly cookie, so a session survives from one day to the next. The frontend calls a same-origin Spring Boot API.
- A companion Locations feature saves places with a map, sharing the same shell.

## Capabilities and Constraints

- Goals: title, optional category (fitness / sleep / productivity / health), `targetPerWeek` 1–7, optional usual place, soft-delete via an `active` flag, `createdAt`.
- Notes: up to five per user, optional title, pinnable.
- To-dos: one line of text, done or not, no description or due date.
- Entries ("behaviors"): note, mood (great / good / neutral / bad / terrible), `completed` boolean, `logDate`, optional link to one goal, optional place, and an optional `durationSeconds` for sessions saved from the time logger (0 to 7 days).
- Entries are done-or-not; there is no partial state, and adding one would be a backend change.
- Weekly progress, streaks, and the goal × day grid are computed in the browser from `GET /api/goals` and `GET /api/behaviors/range`; the backend has no streak or per-goal aggregation.
- A `Report` entity exists (weekly totals, completion rate, most common mood) but no per-goal or per-day breakdown.
- Server timestamps are stored without a timezone, so times of day are not shown to users — dates only.
- Reminders: opt-in Web Push, once a day at the person's chosen hour, only when a goal still has days left.
- Shared goals ("Together"): an owner shares a goal by invite link (7-day, revocable, hashed at rest); up to 8 people each log it themselves. Members see each other's names and which days each marked it done, never notes, moods or places. Each shared goal has one message thread among its members; there is no messaging between arbitrary accounts, no user search, and no shared calendar or notes.

## Brand Commitments

- Name: Mordi. One type family, Crimson Pro, for everything; IBM Plex Mono for dates and counts.
- The user has pinned a **matte** finish: no gradients, gloss, translucency, or background wash anywhere, on the app or the landing page.
- Twenty-five user-selectable color combinations, sixteen light and nine dark. The combination applies site-wide, landing page included, and **Sorbet** is the default. The cream-and-red `paper` combination remains one of them.

## Evidence on Hand

- Real, working API for goals, entries, locations, auth, and weekly reports.
- No customer, testimonial, benchmark, press, or usage numbers exist. Any figure shown in a screenshot or demo is illustrative and must be labeled as such.
- No screenshots of the built app are committed. The browser available in this workspace renders into the session rather than to disk, so design review here reads source plus live DOM measurements.

## Product Principles

1. The week is the unit. Every surface answers "where am I this week?" before anything else.
2. Measure against the user's own target. Never invent a goal, a streak rule, or a guilt mechanic they did not set.
3. Logging is one action. Anything that makes logging slower is a regression, whatever it adds.
4. Say only what the data supports. No fabricated insight, no trend claims the records cannot carry.
5. Empty is a first-run state, not an error. A new account should still show what the app is for.
6. Start focused and grow with use. A new account sees the goals and the week; the rest is added by the person or appears once it has something to show. Too much at once was the most common feedback.

## Accessibility & Inclusion

Keyboard operable throughout, visible focus, WCAG AA contrast for text (verified numerically, not by eye), and respects `prefers-reduced-motion`. Touch targets are at least 44px on coarse pointers; with a mouse, secondary controls may go to 36px with clear spacing. Color alone never carries meaning — progress states also read as text.
