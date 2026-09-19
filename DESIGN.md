# Design

Written from the built app, not from intentions. Tokens live in
`frontend/src/index.css` (type, structural roles) and `frontend/src/themes.css`
(the twenty-five color combinations).

## World

Matte. A goal is a card you carry and the week is the face of it, but nothing
shines: no gradients, no gloss, no translucency, no background wash or texture.
Depth is a surface one step off the ground, a hairline edge, and one soft
shadow. The landing page and the signed-in app share the same tokens and the
same active theme.

## Color

Twenty-five combinations, sixteen light and nine dark, picked by the person and
saved per browser. **Sorbet is the default.**

- Light: paper, sorbet, mint, lagoon, lilac, sand, linen, slate, sage, clover,
  harbor, cobalt, orchid, rose, clay, marigold.
- Dark: graphite, midnight, forest, ember, dusk, ocean, cocoa, ink, moss.

Each sets eleven roles:

| Token | Role |
|---|---|
| `--color-bg` | the ground |
| `--color-surface` | cards, panels, inputs, menus |
| `--color-text` | primary ink |
| `--color-accent` | filled controls, rings, dots, selected states |
| `--color-accent-700` | the accent at text strength |
| `--color-on-accent` | ink on an accent fill |
| `--color-pass` | the week card's field |
| `--color-on-pass` | ink on the week card |
| `--color-signal` | errors |
| `--color-divider` | hairlines |

`--color-text-muted` is derived: 70% ink mixed with the ground.

**The week card is not always the accent.** On light themes it is. On dark
themes it is a deep, accent-tinted field with light ink, because a large light
block on a dark ground was what made the earlier dark themes read as harsh.

**The palettes are generated, not picked.** Every light theme sits on one OKLCH
lightness ladder and every dark theme on another; only hue and chroma differ.
Lightness is then tuned until each pair clears its WCAG minimum with headroom
(4.8 against a 4.5 requirement). Dark themes use a lifted charcoal ground
(≈ L 0.23) and off-white ink rather than near-black and white, and soft
mid-chroma accents rather than neon.

**Contrast is verified, not estimated.** `frontend/scripts/check-theme-contrast.mjs`
re-parses `themes.css` as written and asserts 13 pairs per theme — 325 checks —
including on-pass ink over the pass field. A test (`theme.test.jsx`) fails if
the picker's list and the CSS blocks ever disagree.

## Type

- One family everywhere: **Crimson Pro** (Fontshare, with Google Fonts as a
  second source). Headings differ from body by weight and tracking, never by
  family. `--font-display` and `--font-heading` are aliases of `--font-body`.
- **IBM Plex Mono** for dates, counts, clock, and small group labels, always
  with tabular numerals.
- One scale in `index.css`: display clamp, 21 / 18 / 15 / 14 / 13 / 11px.
- No kicker or eyebrow above a heading, anywhere.

## Form

Corners: `--r-pass` 14px (the week card, goal passes, dialogs), `--r-panel`
10px, `--r-control` 8px (buttons, inputs), `--r-chip` 6px (mood and category
chips, segments). `--r-pill` only on things that are genuinely circular: rings,
dots, the colour chip.

Elevation: `--lift-1/2/3`, each an offset plus a soft blur tinted by the ink,
paired with `--edge`, a 1px inset hairline. No lit top edge, no inner highlight.

Button labels never wrap. Dropdowns and scrolling panels never draw a scrollbar;
where content can overflow, the edges fade instead.

## Motion

`--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` for interaction,
`--ease-pop: cubic-bezier(0.22, 1, 0.36, 1)` for anything opening over the
page. Transform and opacity only.

- **Page arrival:** blocks inside `<main>` fade and rise in, staggered.
- **Goal deck:** opens as a viewport-fitted panel that grows upward from the
  collapsed stack; passes travel on transform, staggered from the top card in
  both directions. Reordering marks the drop slot and commits on release.
- **Segmented control:** one thumb slides between options.
- **Theme change:** every colour eases across over 520ms. A class on `<html>`
  (`theme-easing`) carries the transition only for the length of the switch,
  so hover and press feedback stay instant the rest of the time.
- **Week report:** bars grow from their baseline and grid cells settle in,
  staggered, once on arrival. Nothing loops.
- **Places:** the map is centred once and then moved with `panTo`, so a new
  pin or a chosen place glides into view rather than cutting to it.
- **Lately:** a fixed window that drifts upward when there is more than fits.
  Driven by `requestAnimationFrame` on a transform, handed back to native
  scroll the moment it stops, so a paused feed scrolls normally from where it
  stopped. Stops on click, wheel, touch, keyboard focus, or its pause button.

Under `prefers-reduced-motion` every duration collapses, the deck starts open,
and the feed never moves.

## Components

- **Shell** (`.app`) — 76px labelled rail on desktop, bottom tab bar under
  860px, a solid top bar with the page title, rearrange toggle, primary action,
  colour button and account. Under 560px, Log out moves to Settings.
- **Week card** (`.pass`) — completion percent, Streak/Entries, a Mon–Sun strip
  of day chips that open the month calendar, and two chips in the corner: the
  clock and the weather. On phones the chips take their own row.
- **Goal rings** — conic progress per goal, dashed when nothing is logged;
  draggable, arrow keys to move.
- **Goal deck** — matte passes, grip-to-reorder when open.
- **Timer** — the Clock app's timer in Mordi's materials: a ring that fills
  over an hour with a dot orbiting each minute, large mono digits, and two
  round buttons that keep their places (quiet action left, forward action
  right). Start, pause, resume, finish, then save or discard. Lives under To do
  in the side card. Stored as timestamps (`accumulatedMs`, `resumedAt`), so it
  survives reloads and sleeping tabs. No discard while on the clock.
- **Activity** — a year of logging, one square per day, Monday-led weeks. Four
  accent steps mixed into the surface: one to four logs map straight to a step,
  and only a heavier day stretches the scale. Clicking a day opens the calendar.
  Scrolls sideways natively on touch and trackpads, drags with a mouse, and
  takes arrow keys when focused; a drag never counts as a click on a day.
- **Notes** — up to five, pinned first. Markdown with Obsidian's habits:
  `[[Note]]` links, `#tags`, task lists, tables, backlinks. Opening a note shows
  a reading view (a page set at 16.5px on a 64ch measure, with a line of facts
  above and backlinks below); editing is one framed editor with the mode switch
  and drawn formatting icons inside the frame.
- **Calendar** — day, week and month. Drag on the hours to block out time, drag
  an event to move it, drag its edge to resize; all snap to 15 minutes and
  commit on release. Seven named colours, each mixed against the theme's own
  surface and ink. Month is a six-week grid, dots on a phone. `.ics` files from
  Google, Apple or Outlook import after a preview, repeating events expanded.
- **History** — archived goals with what they amounted to; restore or delete.
- **Week report** (`/reports/:week`) — a headline sentence on the week-card
  field, then a goal × day table heatmap, entries per day against last week,
  the mood mix and mood by day, tracked time against planned time, and places.
  Every chart has a visually hidden data table.
- **Directions** — A over B on a rail with a swap button, pick either end on
  the map, and all four travel modes asked at once so each shows its time.
- **To do + Lately** — one card: one-line to-dos above (Enter to add, tick,
  clear done), the entry feed below, grouped by day with a gap between days.
- **Dialogs** — centred on desktop, bottom sheets under 860px, focus trap,
  scroll lock, Escape, focus restored. The landing page's Sign in / Create
  account uses the same dialog, fields and segmented switch as the app.
- **Select** — a listbox portalled into the themed root, opaque, no scrollbar.
- **Colour picker** — twenty-five swatches grouped Light then Dark, in the top
  bar menu and in Settings, from one shared component.

## Accessibility

One `h1` per page, regions labelled by `h2`. Every control has an accessible
name. 44px targets on coarse pointers. Focus rings are never suppressed. Moving
content can be stopped from the keyboard. The activity grid is described as a
whole rather than as 371 tab stops. Colour never carries meaning alone.
