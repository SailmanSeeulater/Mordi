# Design

Written from the built app, not from intentions. Tokens live in
`frontend/src/index.css` (fonts, structural roles) and `frontend/src/themes.css`
(the ten color combinations). Machine-readable copy: `.impeccable/design.json`.

## World

Apple Wallet crossed with Instagram, user-pinned. Wallet supplies the object: a
full-bleed color **pass** with 22px corners, a card mark, field/value pairs, and
a deck that overlaps and fans. Instagram supplies the energy: gradient progress
rings in a horizontally scrolling rail, saturated two-stop accents, and a bottom
tab bar on phones. The landing page shares the same world, the same tokens, and
the same active theme.

## Color

Ten combinations, six light (`paper`, `sorbet`, `mint`, `lagoon`, `lilac`,
`sand`) and four dark (`graphite`, `midnight`, `forest`, `ember`). **Sorbet is
the default.** Each sets nine roles:

| Token | Role |
|---|---|
| `--color-bg` | the ground |
| `--color-surface` | raised cards, inputs |
| `--color-text` | primary ink |
| `--color-accent` | gradient stop one; fills, rings, filled controls |
| `--color-accent-2` | gradient stop two |
| `--color-accent-700` | the accent at text strength on the ground |
| `--color-on-accent` | ink on the accent gradient |
| `--color-signal` | errors |
| `--color-divider` | hairlines |

Derived: `--color-text-muted` is 70% text mixed with the ground, re-declared on
`.app` and `.mordi-page` so it resolves against the active theme.

The accent gradient — `linear-gradient(135deg, var(--color-accent),
var(--color-accent-2))` — is the only gradient in the system. The one exception
is a soft radial highlight on the week pass, which models light on a colored
object rather than adding a second palette.

**Contrast is verified, not estimated.** `frontend/scripts/check-theme-contrast.mjs`
parses `themes.css` and asserts 14 pairs per theme (140 checks): body, muted,
accent-as-text and signal at 4.5:1; `--color-on-accent` at 4.5:1 over *both*
gradient stops; fills at 3:1. Both gradient stops are deliberately dark enough
(or light enough, on dark themes) for one ink to work across the whole sweep.
Text on the gradient always ships at full strength — a 16% translucent chip
field measured 3.6:1 and was removed.

## Type

- Display: **Gambarino**, self-hosted (`public/fonts/gambarino/`). Big figures, page and panel titles, card marks.
- Body: **Archivo**. Sizes: 15 / 14 / 13 / 11px, weights 400 / 600 / 700.
- Mono: **IBM Plex Mono** for dates, counts and small labels, always with `font-variant-numeric: tabular-nums`.
- No kicker or eyebrow above a heading, anywhere.

## Form

Corners: `--r-pass: 22px` (passes, dialogs), `--r-panel: 16px` (panels),
`--r-control: 12px` (inputs, chips, calendar days), `--r-pill: 999px` (buttons,
rings, tags). Nothing in the signed-in app has a square corner.

Elevation is declared once per element, as shadow only — `--lift-1/2/3`, each an
offset plus a soft blur tinted by the ink. A 1px border under a shadow is not
used. Hairlines appear only as row separators inside a panel.

## Motion

`--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`, 140–320ms, transform and opacity
only. Signature interaction: the goal deck fans from an overlapped stack to a
spread and back, and switching color combination restacks it with a 45ms
per-card stagger. Under `prefers-reduced-motion` every duration collapses to 1ms
and the deck defaults to its fanned state.

## Components

- **Pass** (`.pass`) — the week: gradient field, display-scale percent, Streak/Entries fields, a Mon–Sun day strip that opens the month calendar, and a filled on-accent pill as the primary action.
- **Goal pass** (`.goal-pass`, `.goal-card`) — one per goal, its field an accent tint in one of four steps so neighbours differ, with a gradient mark tile, a 7-dot week, and what's left to target.
- **Ring** (`.app-ring`) — conic-gradient progress; dashed outline when nothing is logged, so empty never reads as full. The count repeats as text, so color never carries meaning alone.
- **Shell** (`.app`) — 76px labelled rail on desktop, bottom tab bar under 860px, sticky translucent top bar carrying the page title, the color button, and the account.
- **Dialogs** — centered cards on desktop, bottom sheets under 860px, with a focus trap, scroll lock, Escape to close, and focus restored to the opener.
- **Calendar** (`.cal`) — six Monday-led weeks; logged days carry the gradient, logged-not-done a 20% tint, past empty days a dashed outline; picking a day lists its entries.

## Accessibility

One `h1` per page (the top bar's title), regions labelled by `h2`. Every control
has an accessible name. 44px targets on coarse pointers; 36px minimum with
spacing for secondary controls on a mouse. Focus rings are never suppressed, and
they invert to `--color-on-accent` inside the pass, where the accent ring would
be invisible.
