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
- Auth is email plus password, JWT in `localStorage`; the frontend talks to a Spring Boot API at `https://latesailor.dev`.
- A companion Locations feature saves places with a map, sharing the same shell.

## Capabilities and Constraints

- Goals: title, optional category (fitness / sleep / productivity / health), `targetPerWeek` 1–7, soft-delete via an `active` flag, `createdAt`.
- Entries ("behaviors"): note, mood (great / good / neutral / bad / terrible), `completed` boolean, `logDate`, optional link to one goal.
- Entries are done-or-not; there is no partial state, and adding one would be a backend change.
- Weekly progress, streaks, and the goal × day grid are computed in the browser from `GET /api/goals` and `GET /api/behaviors/range`; the backend has no streak or per-goal aggregation.
- A `Report` entity exists (weekly totals, completion rate, most common mood) but no per-goal or per-day breakdown.
- Server timestamps are stored without a timezone, so times of day are not shown to users — dates only.
- No notification, reminder, sharing, or multi-user capability exists. Do not imply any.

## Brand Commitments

- Name: Mordi. Display face Gambarino (self-hosted), body Archivo, mono IBM Plex Mono.
- The user has pinned a visual world of Apple Wallet crossed with Instagram, and a user-selectable set of ten color combinations (six light, four dark).
- The combination applies site-wide, landing page included, and **Sorbet** is the default. The cream-and-red `paper` combination is kept as one of the ten, so the original public face remains available, but it is no longer fixed.

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

## Accessibility & Inclusion

Keyboard operable throughout, visible focus, WCAG AA contrast for text (verified numerically, not by eye), and respects `prefers-reduced-motion`. Touch targets are at least 44px on coarse pointers; with a mouse, secondary controls may go to 36px with clear spacing. Color alone never carries meaning — progress states also read as text.
