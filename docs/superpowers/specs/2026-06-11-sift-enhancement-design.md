# Sift Enhancement — Design Spec (v2)

Date: 2026-06-11
Status: revised after user spec review — personal-only scope, editing, reminders, repeats added
Project: `Z:\Claude\Projects\Sift\sift` — Vite + React 18 PWA with Capacitor Android wrapper

## Goal

Make Sift a polished, phone-first **personal** organizer: capture-and-route with due dates, editing, reminders, and repeating tasks — without changing its core: a rule-based classifier behind a single AI swap point. The Corporate edition is removed from this app and will become a separate product later.

## Decisions made with the user

| Question | Decision |
|---|---|
| Scope | Visual & UX polish + organizer features. No real AI swap this round. |
| Design direction | A — Refined Riso: keep the print-shop identity, polish it. |
| Organizer features | Due dates from text, drag-and-drop refiling, dark mode, stats strip. |
| Implementation approach | Restructure `App.jsx` into components first, then build features. |
| Mobile board | B — swipe pager with tray tabs (desktop keeps multi-column grid). |
| Edition (spec review) | **Personal only.** Corporate split off into a separate future app. |
| Editing (spec review) | Items are editable: text, due, repeat, tray. |
| Reminders (spec review) | Mobile to-do reminders; full on native Android, best-effort on web. |
| Repeats (spec review) | Repeat cycles: daily / weekly / monthly / yearly / custom "every N units". |

## Architecture

State management stays as-is: single `useState` tree in `App.jsx`, persisted to localStorage via `store.js`. No state library. Components receive data and callbacks as props.

```
src/
  App.jsx              state owner + composition (~170 lines after split)
  components/
    Capture.jsx        input + route button + example chips
    Trace.jsx          routing receipt
    PendingSlip.jsx    new-tray suggestion
    Toolbar.jsx        filter, +tray, sort toggle, theme cycle, export/import/reset
    Board.jsx          DnD context; responsive: desktop grid / mobile snap-pager
    Tray.jsx           droppable tray section
    ItemCard.jsx       draggable card + date chip + repeat glyph
    EditSheet.jsx      NEW — edit item: text, due, repeat, tray, reminder, delete
    StatsStrip.jsx     captured/done/streak counters
    Toast.jsx          undo toast
  lib/
    classifier.js      UNCHANGED — remains the single AI swap point
    store.js           + theme persistence, + personal-only migration
    dates.js           NEW — due-date parser + repeat arithmetic
    notify.js          NEW — reminder scheduling abstraction (native/web)
```

Dependencies added: `@dnd-kit/core`, `@capacitor/local-notifications` (runtime), `vitest` (dev). Nothing else.

## Personal-only data model

- `state` flattens to `{ categories, items, theme }` — no `workspaces`, no `active`, no Personal/Corporate toggle in the header.
- Seeds keep the personal trays (Tasks, Ideas, Plans, Schedule) and personal example chips.
- Corporate lexicons stay in `classifier.js` (harmless, reusable by the future corporate app); corporate seeds and UI are removed.
- **Migration:** loading the old two-workspace shape lifts `workspaces.personal` into the new flat shape. Before migrating, the full old blob is copied to localStorage key `sift.v1.backup` so corporate data is never silently destroyed. Old exports import the same way.

## Feature design

### 1. Due dates (`lib/dates.js`)

`parseDue(text, now = new Date())` → `{ due: number|null, hasTime: boolean, vague: boolean, label: string } | null`

Recognizes (case-insensitive):
- Relative days: `today`, `tonight` (20:00), `tomorrow`
- Vague future (user-added): `in the future`, `someday`, `eventually`, `later` → `{ due: null, vague: true, label: "SOMEDAY" }` — a muted chip, no timestamp, no reminder. *(Interpretation of the spec edit `'undefined', 'in the future'` — flag if wrong.)*
- Weekday names (full + 3-letter): next occurrence strictly after today
- Month-day: `jun 15`, `june 15`, `15 june` (next occurrence; year rolls over if past)
- Times: `3pm`, `3:30pm`, `15:30`, `at 3` (combined with any date above, or alone = today)
- No match → `null`; items without dates behave exactly as before

Item schema gains `due`, `hasTime`, `vague`. Parsed at capture; editable later in the EditSheet (which also has a "detect from text" button to re-run the parser explicitly — no silent re-parsing).

UI: `ItemCard` shows a mono chip (`FRI 3PM`, `JUN 15`, `TODAY`, `SOMEDAY`). Overdue (`due < now`) and not done → chip turns riso red. Toolbar sort toggle: `newest ↔ due` (dated first by due, then SOMEDAY, then undated by recency).

### 2. Editing (`EditSheet.jsx`)

- Open: tap the card text (mobile & desktop). Renders as a bottom sheet on mobile, centered modal on desktop — styled as a riso "correction slip" (dashed border, stamp header).
- Fields: text (textarea), due date + time (native `date`/`time` inputs, clearable), repeat rule (see §3), tray (select), reminder on/off, delete button.
- Save = one atomic item update. Escape/scrim tap = discard. Editing never touches `refiled`/training semantics.

### 3. Repeatable tasks

- Schema: `repeat: null | { every: number, unit: "day" | "week" | "month" | "year" }`. Presets daily/weekly/monthly/yearly = `every: 1`; custom = user-chosen N + unit (covers "any other time cycle").
- Completing a repeating item: records `doneAt` (stats credit), then immediately resets `done: false` and advances `due` by one cycle — from the item's current due, or from now if it had none. A brief toast confirms: "done — next: TUE 3PM".
- Month/year arithmetic clamps to the last valid day (Jan 31 + 1 month → Feb 28/29).
- `ItemCard` shows a `↻` glyph with the cycle (`↻ 2W`). Stopping a repeat = edit → repeat: none, or delete the item.
- `nextOccurrence(due, repeat, now)` lives in `dates.js` (pure, tested).

### 4. Reminders (`lib/notify.js`)

One abstraction, two backends, chosen by `Capacitor.isNativePlatform()`:

- **Native Android (APK):** `@capacitor/local-notifications` — OS-scheduled notifications that fire with the app closed. Scheduled at the item's due time; rescheduled when an item is edited, completed (repeats), or deleted. Permission requested the first time a reminder is armed.
- **Web/PWA:** Notification API + a 60s in-app check while Sift is open (tab or installed window). Honest limitation, stated in README and in a one-time in-app hint: the web cannot fire scheduled notifications with the page fully closed (that needs a push server — out of scope).

Policy: newly captured or edited items with a concrete `due` get `remind: true` by default (toggle per item in EditSheet); migrated legacy items stay `remind: false` so an update never starts firing notifications for old data. Items with a date but no time fire at **09:00**. Vague/SOMEDAY and undated items never schedule reminders. Notification tap opens/focuses Sift.

### 5. Drag-and-drop refiling (`@dnd-kit/core`)

- `Board` wraps trays in `DndContext`; each `ItemCard` is a draggable, each `Tray` (and each mobile tray *tab*) is a droppable.
- Pointer sensor activation: 6px distance on desktop (so clicks still work), 250ms long-press + tolerance on touch (so scrolling still works; tap still opens EditSheet).
- Drop on tray/tab → same `refile()` path as the dropdown: sets `refiled: true` (training-signal semantics preserved).
- `DragOverlay` shows the card lifted with a stronger offset shadow (riso "pulled proof" look). Drop target gets an ink-pulse highlight.
- The per-card dropdown remains as keyboard/screen-reader-accessible fallback.

### 6. Dark mode — "night print shop"

- `data-theme` attribute on `<html>`: `auto | light | dark`, cycled by a header button (replaces the removed edition toggle), persisted as `state.theme`. `auto` follows `prefers-color-scheme`.
- Dark token overrides: paper `#17171b`, card `#212126`, ink `#f0ede6`, line `#3a3a40`, muted `#8e8a82`.
- Tray colors: stored hexes untouched; render-time map `inkFor(hex, theme)` in `store.js` converts each riso ink to a fluorescent night counterpart (`#F15060 → #FF48B0` fluoro pink, `#00A95C → #5EFC8D` fluoro green, brighter blue/sunflower/violet/orange/teal/federal).
- `<meta name="theme-color">` updated dynamically.

### 7. Mobile swipe pager (< 640px)

- Sticky tray-tab bar under the header: one chip per tray (name + count), horizontally scrollable, active tab inverted (ink background).
- Board is a horizontal snap container: `scroll-snap-type: x mandatory`, one tray per viewport width, `scroll-snap-align: center`.
- Active tab ↔ scroll position synced via `IntersectionObserver`; tapping a tab smooth-scrolls to its tray.
- Tabs are drop targets, so drag-to-refile works without leaving the current page.
- Desktop (≥ 640px): unchanged multi-column `auto-fill` grid; tab bar hidden.

### 8. Stats strip

- New items record `created` (epoch ms); completing sets `doneAt` (kept for repeats — see §3).
- Strip (above footer on desktop, above capture bar on mobile): `today: N captured · M done · streak K days`.
- Streak = consecutive calendar days ending today with ≥ 1 `doneAt`. Legacy items without timestamps are excluded from stats (never guessed).

### 9. Visual & UX polish (direction A)

- Motion: card-drop spring, tray ink-pulse on drop, toast slide-up, sheet slide-up; everything behind `prefers-reduced-motion`.
- Touch targets ≥ 44px; visible focus states kept.
- Empty states: small riso registration-mark doodle + hint instead of bare text.
- Spacing pass on an 8px rhythm; capture bar and toolbar alignment tightened.
- The riso identity (paper grain, hard offset shadows, mono labels, 0 border-radius, pressable buttons) is preserved everywhere.

## Data migration

`store.js → load()`:
1. Old two-workspace shape → backup whole blob to `sift.v1.backup`, then lift `workspaces.personal` to the flat shape.
2. Additive field patches: missing `theme` → `"auto"`; missing item fields → `due: null, hasTime: false, vague: false, repeat: null, remind: false, created: null, doneAt: null`.
Same storage key (`sift.v1`); old exports import cleanly through the same path.

## Infra

- Service worker cache name bumps to `sift-v2`.
- README updated: personal-only positioning, new features, reminder platform matrix, test command.
- Capacitor: add `@capacitor/local-notifications`, document `npx cap sync android`; `npm run android` flow otherwise unchanged.
- Optional post-build step: `vercel deploy dist` for phone installation via PWA.

## Testing

Vitest (`npm test`):
- `dates.test.js` — parser: weekdays, tomorrow, month-day, times, vague-future phrases, no-match, year rollover; `nextOccurrence`: day/week/month/year cycles, month-end clamping.
- `classifier.test.js` — sanity: empty categories guard, confidence bands, custom-tray words.
- `store.test.js` — migration: two-workspace shape lifts personal + writes backup; missing fields defaulted.
- `notify` logic — pure scheduling-decision parts unit-tested (what gets scheduled when); platform plumbing verified manually.

UI verified manually + `vite build` smoke test (and a browser pass with the dev server).

## Out of scope

Real Claude API classification, accounts/sync/Supabase, the Corporate edition (separate future app), push-server web notifications, the Kazakhstan museum app (separate project, next).
