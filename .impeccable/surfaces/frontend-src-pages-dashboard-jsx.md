---
version: 1
slug: "frontend-src-pages-dashboard-jsx"
primary_target: "frontend/src/pages/Dashboard.jsx"
related_targets: ["frontend/src/pages/Goals.jsx","frontend/src/pages/Settings.jsx"]
---

Scope: the signed-in app — dashboard, goals, settings — sharing one shell, plus the landing page, which the user later asked to bring into the same world (same data-theme, same corner language and gradient accent; its "Why Mordi" and "Features" sections were removed on request). Visitor mode: Operate (the user completes a task: read the week, log one entry). Onboarding matters because users arrive as strangers with an empty account.

Audience and job: people rebuilding routines, opening the app for under a minute, several times a week. Action: see the week, log today, adjust a goal. Proof: their own entries. Constraints: done-or-not entries, dates without times, weekly targets of 1–7, no notifications or sharing.

## Direction contract

THESIS: A goal is a card you carry, and the week is the face of it. The app refuses the dashboard-of-panels arrangement — a grid of equal rectangles with a chart in one of them — and refuses the log-book ruled sheet it replaces. Goals are physical passes in a stack; the week lives on the pass itself, not in a table beside it.

OWN-WORLD: Apple Wallet crossed with Instagram, brief-pinned. Wallet supplies the object: full-bleed color passes, 22px corners, a stack that overlaps and fans, one pass raised at a time, a top edge strip per pass. Instagram supplies the social-app energy: a gradient progress ring around each goal, a horizontally scrolling rail of goals at the top of the dashboard, saturated two-stop gradients, a bottom tab bar on phones. Ten user-selectable combinations (six light, four dark) each set ground, surface, ink, and a two-stop accent gradient; the accent gradient is the only gradient in the system. Type: Gambarino for display, Archivo for everything else, IBM Plex Mono for dates and counts. Component language: soft-cornered cards (22px passes, 16px panels, 12px controls), no hairline-ruled tables, no square corners anywhere.

STORY: The visitor understands within one viewport that their week is measured against targets they set, believes the app is keeping the count for them, and logs one entry without leaving the first screen.

FIRST VIEWPORT: Top left a 76px rail on desktop, wide enough to carry a text label under each icon (widened from 56px during the build: icon-only rails made the five sections guesswork); on phones a bottom tab bar instead. Below the top bar, a horizontally scrolling rail of goal rings (Instagram stories, 64px, gradient ring encoding this week's progress, the ring a dashed outline when nothing is logged). Under it, the week pass: one full-bleed accent-gradient card, 22px corners, carrying the big completion percent at display scale, a Streak/Entries field pair in Wallet's field-and-value grammar, the Mon–Sun strip of day chips along its lower edge (each chip a button opening a month calendar on that day), today's chip raised, and the primary "Log today" action as a filled pill on the pass itself. No kicker label above the figure: the craft floor's one unconditional ban. Beneath that, the goal stack: each goal a pass in the accent's tint (four tint steps, so neighbours never share a field), overlapping the one before it by about 60% at five goals or fewer and tighter above that, the top pass fully visible. The stack fans open on click or Enter. Right of the pass on desktop (below it on phones), the entry feed: mood chip, day, note, in a single soft column.

FORM: Brief-pinned direction (Apple Wallet × Instagram), so the concept roll was skipped per new-work §3 — a brief-pinned direction beats the roll. No seed key exists for this surface. Ranked first and only on the candidate list because the user pinned it. Code-led build: no image generation is available in this harness, so there is no comp and no comp round; the ambition rides in this FIRST VIEWPORT block and the signature interaction below. Signature interaction: the goal stack fans from an overlapped deck to a spread and back, one spring-eased moment, with each pass's week strip revealed on expand; the theme button restacks the deck in the new combination. Motion grammar: exponential ease-out, 180–320ms, transform and opacity only, fully disabled under prefers-reduced-motion with the expanded state as the static default.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: none blocking. The weekly report route stays a placeholder this round.
