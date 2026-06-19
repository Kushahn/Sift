# Sift — collapsible to-do list layout (design)

Date: 2026-06-19 · Status: approved · Branch: dev

## Goal
Make Sift read and scroll like a to-do list instead of a kanban/inbox board.
Easier to read; scroll *through* categories top-to-bottom. Keep the riso brand
(ink colors, IBM Plex Mono / Archivo type) — change layout, density, and depth.

## Decisions
1. **Layout:** one vertical column of collapsible sections, scrolled top→bottom.
   Same on desktop and mobile (the mobile swipe pager is removed).
2. **Section header:** `▶/▼ caret · ● ink-dot · NAME · count · ×`. Caret or name
   toggles fold. Folded section renders header only.
3. **Fold state persists** per category (`collapsed` bool) via the existing
   `save(data)` effect — no new persistence layer.
4. **Item row:** no per-item tilt, no always-visible footer. One line:
   `□ checkbox · text · due-chip · repeat-glyph`. Secondary controls
   (move-to-tray select, delete ×) and meta (timestamp/confidence) move to
   hover (desktop) and into the EditSheet (tap text — already wired).
5. **Shadows:** remove **all** `box-shadow`. Separation comes from the `1.5px`
   border + `6px` colored ink top-bar per section. Button press feedback
   switches from collapsing-shadow to a background/border shift.
6. **Drag-to-refile kept:** each section is a drop target; dropping an item on
   another section refiles it and teaches the router (`onRefile` → `learn`).
   `refile-dnd` and `refile-learns` must keep passing.

## Files touched
- `Board.jsx` — vertical stack; delete grid, swipe pager, `traytabs`/`TrayTab`,
  IntersectionObserver, active-tray scroll logic.
- `Tray.jsx` — fold caret + collapsed rendering; section is the droppable.
- `ItemCard.jsx` — drop tilt; single-line row; hover-revealed actions.
- `styles.css` — remove all shadows + press-shadow animation; vertical layout;
  delete `.traytabs`/`.traytab`/mobile-pager rules; flat button press.
- `App.jsx` — `toggleCollapse(catId)` handler.
- `store.js` — `collapsed:false` default in seeds + `normalize`.
- `features.json` — add `todo-list-layout` (ui), verify e2e, `passes:true`.

## Out of scope
- Reordering items within a tray (drag only refiles between trays, as today).
- `native-reminder-sync` (needs an Android build).

## Verification
- `npm test` stays green (add a store test: `collapsed` survives normalize/round-trip).
- Browser e2e: fold/unfold persists across reload; drag-refile still learns;
  rows readable; no shadows anywhere; mobile = same vertical list.
