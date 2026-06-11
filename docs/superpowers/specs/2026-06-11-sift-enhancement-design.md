# Sift Enhancement — Design Spec

Date: 2026-06-11
Status: approved by user (design conversation, this session)
Project: `Z:\Claude\Projects\Sift\sift` — Vite + React 18 PWA with Capacitor Android wrapper

## Goal

Polish Sift visually and ergonomically (phone-first), and add four organizer features — without changing what Sift is: a capture-and-route organizer with a rule-based classifier behind a single swap point.

## Decisions made with the user

| Question | Decision |
|---|---|
| Scope | Visual & UX polish + organizer features. No real AI swap this round. |
| Design direction | A — Refined Riso: keep the print-shop identity, polish it. |
| Organizer features | Due dates from text, drag-and-drop refiling, dark mode, stats strip — all four. |
| Implementation approach | Restructure `App.jsx` into components first, then build features. |
| Mobile board | B — swipe pager with tray tabs (desktop keeps multi-column grid). |

## Architecture

State management stays as-is: single `useState` tree in `App.jsx`, persisted to localStorage via `store.js`. No state library. Components receive data and callbacks as props.

```
src/
  App.jsx              state owner + composition (~150 lines after split)
  components/
    Capture.jsx        input + route button + example chips
    Trace.jsx          routing receipt
    PendingSlip.jsx    new-tray suggestion
    Toolbar.jsx        filter, +tray, sort toggle, theme cycle, export/import/reset
    Board.jsx          DnD context; responsive: desktop grid / mobile snap-pager
    Tray.jsx           droppable tray section
    ItemCard.jsx       draggable card + date chip
    StatsStrip.jsx     captured/done/streak counters
    Toast.jsx          undo toast
  lib/
    classifier.js      UNCHANGED — remains the single AI swap point
    store.js           + theme persistence, + additive migration
    dates.js           NEW — due-date parser (~80 lines)
```

Dependencies added: `@dnd-kit/core` (runtime), `vitest` (dev). Nothing else.

## Feature design

### 1. Due dates (`lib/dates.js`)

`parseDue(text, now = new Date())` → `{ due: number(epoch ms), hasTime: boolean, label: string } | null`

Recognizes (case-insensitive):
- Relative days: `today`, `tonight` (20:00), `tomorrow`
- Weekday names (full + 3-letter): next occurrence strictly after today
- Month-day: `jun 15`, `june 15`, `15 june` (next occurrence; year rolls over if past)
- Times: `3pm`, `3:30pm`, `15:30`, `at 3` (combined with any date above, or alone = today)
- No match → `null`; items without dates behave exactly as before

Item schema gains `due` (epoch ms or null) and `hasTime`. Set at capture time only; re-parsing on edit is out of scope (items are not editable today).

UI: `ItemCard` shows a mono chip (`FRI 3PM`, `JUN 15`, `TODAY`). Overdue (`due < now`) and not done → chip turns riso red. Toolbar gains a sort toggle: `newest ↔ due` (items without `due` sort last, then by recency).

### 2. Drag-and-drop refiling (`@dnd-kit/core`)

- `Board` wraps trays in `DndContext`; each `ItemCard` is a draggable, each `Tray` (and each mobile tray *tab*) is a droppable.
- Pointer sensor activation: 6px distance on desktop (so clicks still work), 250ms long-press + tolerance on touch (so scrolling still works).
- Drop on tray/tab → same `refile()` path as the dropdown: sets `refiled: true` (the training-signal semantics are preserved).
- `DragOverlay` shows the card lifted with a stronger offset shadow (riso "pulled proof" look). Drop target gets an ink-pulse highlight.
- The per-card dropdown remains as keyboard/screen-reader-accessible fallback.

### 3. Dark mode — "night print shop"

- `data-theme` attribute on `<html>`: `auto | light | dark`, cycled by a header button, persisted in store (`state.theme`). `auto` follows `prefers-color-scheme`.
- All colors already flow through CSS custom properties; dark theme overrides them: paper `#17171b`, card `#212126`, ink `#f0ede6`, line `#3a3a40`, muted `#8e8a82`.
- Tray colors: stored hexes stay untouched; a render-time map converts each riso ink to its fluorescent night counterpart (e.g. `#F15060 → #FF48B0` fluoro pink, `#00A95C → #5EFC8D` fluoro green, brighter variants for blue/sunflower/violet/orange/teal/federal). Implemented as `inkFor(hex, theme)` in `store.js`.
- `<meta name="theme-color">` updated dynamically to match.

### 4. Mobile swipe pager (< 640px)

- Sticky tray-tab bar under the header: one chip per tray (name + count), horizontally scrollable, active tab inverted (ink background).
- Board becomes a horizontal snap container: `scroll-snap-type: x mandatory`, each tray `scroll-snap-align: center`, one tray per viewport width.
- Active tab ↔ scroll position synced via `IntersectionObserver`; tapping a tab smooth-scrolls to its tray.
- Tabs are drop targets, so drag-to-refile works across trays without leaving the current page.
- Desktop (≥ 640px): unchanged multi-column `auto-fill` grid; tab bar hidden.

### 5. Stats strip

- New items record `created` (epoch ms); toggling done sets/clears `doneAt`.
- Strip (above footer on desktop, above capture bar on mobile): `today: N captured · M done · streak K days`.
- Streak = consecutive calendar days ending today with ≥ 1 `doneAt`. Legacy items without timestamps are excluded from stats (never guessed).

### 6. Visual & UX polish (direction A)

- Motion: card-drop spring, tray ink-pulse on drop, toast slide-up, ink-roll wipe on workspace switch; everything behind `prefers-reduced-motion`.
- Touch targets ≥ 44px on interactive elements; visible focus states kept.
- Empty states: small riso registration-mark doodle + hint instead of bare text.
- Spacing pass on an 8px rhythm; capture bar and toolbar alignment tightened.
- The riso identity (paper grain, hard offset shadows, mono labels, 0 border-radius, pressable buttons) is preserved everywhere.

## Data migration

`store.js → load()` patches loaded/imported state additively: missing `theme` → `"auto"`; missing item fields → `due: null, hasTime: false, created: null, doneAt: null`. Same storage key (`sift.v1`); no destructive changes; old exports import cleanly.

## Infra

- Service worker cache name bumps to `sift-v2` (forces refresh of precached shell).
- README updated for new features and test command.
- Capacitor config untouched; `npm run android` flow unchanged.
- Optional post-build step: `vercel deploy dist` for phone installation via PWA.

## Testing

Vitest (`npm test`):
- `dates.test.js` — parser cases: weekdays, tomorrow, month-day, times, combinations, no-match, year rollover.
- `classifier.test.js` — sanity: empty categories guard, confidence bands, custom-tray words.
- `store.test.js` — migration: old-shape state loads with new fields defaulted.

UI verified manually + `vite build` smoke test (and a browser pass with the dev server).

## Out of scope

Real Claude API classification, accounts/sync/Supabase, item editing, notifications/reminders, the Kazakhstan museum app (separate project, next).
