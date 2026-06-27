# Collapsible To-Do List Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recast Sift's kanban-style board into a single vertical column of collapsible to-do sections, flat (no shadows), with readable single-line rows.

**Architecture:** `Board` renders trays in a vertical flex stack (no grid, no mobile swipe pager). Each `Tray` is a droppable section with a fold caret; `collapsed` lives on the category and persists through the existing `save(data)` localStorage effect. Item rows lose their tilt and footer; secondary actions reveal on hover (desktop) / live in the EditSheet (touch). All `box-shadow` is removed; separation comes from borders + the colored ink top-bar.

**Tech Stack:** React 18 + Vite + Vitest, @dnd-kit/core, CSS (no framework).

## Global Constraints

- Riso brand preserved: `--paper/--card/--ink` palette, IBM Plex Mono + Archivo type, `1.5px` borders, `6px` colored top-bar per section, riso ink dots. Only depth/layout/density change.
- No new dependencies (ladder rung 4).
- Existing suite must stay green; UI is verified in-browser (project convention: "browser for UI, vitest for lib").
- Drag-to-refile must keep teaching the router (`refile-dnd`, `refile-learns` stay passing).
- `border-radius` stays `0` (sharp corners) unless explicitly changed.

---

### Task 1: Persist `collapsed` on categories (store + test)

**Files:**
- Modify: `sift/src/lib/store.js`
- Test: `sift/src/lib/store.test.js`

**Interfaces:**
- Produces: categories carry `collapsed: boolean`; `normalize()` defaults it to `false` and preserves an explicit value. All later tasks read `cat.collapsed`.

- [ ] **Step 1: Write the failing tests** — add to `sift/src/lib/store.test.js` inside the `describe("normalize", …)` block:

```js
  it("defaults collapsed to false on categories", () => {
    expect(normalize(freshSeeds()).categories[0].collapsed).toBe(false);
  });
  it("keeps an explicit collapsed flag", () => {
    const src = { ...freshSeeds(), categories: freshSeeds().categories.map((c) => ({ ...c, collapsed: true })) };
    expect(normalize(src).categories.every((c) => c.collapsed === true)).toBe(true);
  });
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd sift && npx vitest run src/lib/store.test.js`
Expected: FAIL — `collapsed` is `undefined`, not `false`.

- [ ] **Step 3: Implement** — in `sift/src/lib/store.js`, add a category default and map it in `normalize`:

After the `ITEM_DEFAULTS` const (line ~28) add:

```js
const CAT_DEFAULTS = { collapsed: false };
```

In `normalize`, change the `categories` line from:

```js
    categories: src.categories,
```

to:

```js
    categories: src.categories.map((c) => ({ ...CAT_DEFAULTS, ...c })),
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd sift && npx vitest run src/lib/store.test.js`
Expected: PASS (all normalize tests).

- [ ] **Step 5: Commit**

```bash
git add sift/src/lib/store.js sift/src/lib/store.test.js
git commit -m "feat: persist per-tray collapsed flag (normalize default)"
```

---

### Task 2: Vertical collapsible sections (Board + Tray + App + layout CSS)

**Files:**
- Modify: `sift/src/components/Board.jsx` (full replace)
- Modify: `sift/src/components/Tray.jsx` (full replace)
- Modify: `sift/src/App.jsx` (add handler + prop)
- Modify: `sift/src/styles.css` (layout + fold; delete pager/tabs/grid)

**Interfaces:**
- Consumes: `cat.collapsed` (Task 1).
- Produces: `onToggleCollapse(catId)` threaded App → Board → Tray; `Board` no longer renders `traytabs`/`TrayTab`/IntersectionObserver/`traywrap`.

- [ ] **Step 1: Add the toggle handler in `App.jsx`** — after `renameTray` (line ~175):

```jsx
  const toggleCollapse = (id) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, collapsed: !c.collapsed } : c)) }));
```

Then pass it to `<Board>` (line ~302) by adding the prop:

```jsx
        onRenameTray={renameTray} onDeleteTray={deleteTray} onToggleCollapse={toggleCollapse}
```

- [ ] **Step 2: Replace `sift/src/components/Board.jsx`** with the vertical stack (tabs/observer/grid removed):

```jsx
import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, pointerWithin,
} from "@dnd-kit/core";
import Tray from "./Tray.jsx";
import ItemCard from "./ItemCard.jsx";

function sortItems(list, sort) {
  if (sort !== "due") return list; // capture order is already newest-first
  return [...list].sort((a, b) => {
    const rank = (it) => (it.due != null ? 0 : it.vague ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return a.due - b.due;
    return (b.created || 0) - (a.created || 0);
  });
}

export default function Board({ categories, items, sort, canDelete, onRenameTray, onDeleteTray, onToggleCollapse, onToggleDone, onRefile, onRemove, onEdit, theme }) {
  const [dragId, setDragId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragEnd(e) {
    setDragId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const catId = String(overId).split(":")[1];
    const item = items.find((it) => it.id === e.active.id);
    if (catId && item && item.catId !== catId) onRefile(item.id, catId);
  }

  const dragItem = dragId ? items.find((it) => it.id === dragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setDragId(e.active.id)}
      onDragCancel={() => setDragId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        {categories.map((c) => (
          <Tray
            key={c.id}
            cat={c}
            items={sortItems(items.filter((it) => it.catId === c.id), sort)}
            categories={categories}
            theme={theme}
            canDelete={canDelete}
            onRename={onRenameTray}
            onDelete={onDeleteTray}
            onToggleCollapse={onToggleCollapse}
            onToggleDone={onToggleDone}
            onRefile={onRefile}
            onRemove={onRemove}
            onEdit={onEdit}
          />
        ))}
      </div>
      <DragOverlay>
        {dragItem && (
          <div className="dragproof">
            <ItemCard item={dragItem} categories={categories}
              onToggleDone={() => {}} onRefile={() => {}} onRemove={() => {}} onEdit={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 3: Replace `sift/src/components/Tray.jsx`** with fold caret + collapsed render:

```jsx
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import ItemCard from "./ItemCard.jsx";
import { inkFor } from "../lib/store.js";

export default function Tray({ cat, items, categories, canDelete, onRename, onDelete, onToggleCollapse, onToggleDone, onRefile, onRemove, onEdit, theme }) {
  const { isOver, setNodeRef } = useDroppable({ id: "tray:" + cat.id });
  const [editName, setEditName] = useState(null);
  const collapsed = !!cat.collapsed;

  function commitRename() {
    const name = (editName || "").trim();
    if (name) onRename(cat.id, name);
    setEditName(null);
  }

  return (
    <section
      ref={setNodeRef}
      className={"tray" + (isOver ? " over" : "") + (collapsed ? " collapsed" : "")}
      style={{ "--c": inkFor(cat.color, theme) }}
    >
      <header className="tray-head">
        <button
          className="fold"
          onClick={() => onToggleCollapse(cat.id)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${cat.name}` : `Collapse ${cat.name}`}
        >
          {collapsed ? "▶" : "▼"}
        </button>
        <span className="drum" aria-hidden="true" />
        {editName !== null ? (
          <input
            autoFocus
            className="rename"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditName(null);
            }}
            onBlur={commitRename}
            aria-label="Rename tray"
          />
        ) : (
          <button className="tray-name" onClick={() => setEditName(cat.name)} title="Rename">
            {cat.name}
          </button>
        )}
        <span className="count">{items.length}</span>
        {canDelete && (
          <button className="x" onClick={() => onDelete(cat.id)} aria-label={`Delete tray ${cat.name}`}>×</button>
        )}
      </header>

      {!collapsed && items.length === 0 && <div className="empty">empty — type above</div>}

      {!collapsed &&
        items.map((it) => (
          <ItemCard key={it.id} item={it} categories={categories}
            onToggleDone={onToggleDone} onRefile={onRefile} onRemove={onRemove} onEdit={onEdit} />
        ))}
    </section>
  );
}
```

- [ ] **Step 4: Rework layout CSS in `sift/src/styles.css`.**

(a) Replace the `.board` grid rule (lines ~228-233):

```css
.board {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 18px;
  align-items: start;
}
```

with a vertical stack:

```css
.board {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
```

(b) Narrow the app to a readable column — change `.sift` `max-width` (line ~41) from `1180px` to:

```css
  max-width: 760px;
```

(c) Add fold-caret + collapsed rules (place near the `.tray-head` block, ~line 243):

```css
.fold {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  flex: none;
}
.fold:hover { color: var(--ink); }
.tray.collapsed .tray-head { margin-bottom: 0; }
```

(d) Delete the whole mobile swipe pager + tabs section (lines ~557-609: the `.traytabs { display: none; }` rule and the entire `@media (max-width: 640px) { .traytabs … .traywrap … }` block). The vertical `.board` is now identical on mobile.

- [ ] **Step 5: Verify in browser**

Run: `cd sift && npm run dev`, open the app.
Expected: trays stack in one vertical column on desktop; click a ▼ caret → that tray folds to its header (▶) and the count still shows; click again → expands. Resize narrow (<640px) → still one vertical column, no horizontal swipe pager, no tab strip.

- [ ] **Step 6: Verify fold persists**

Collapse a tray, reload the page.
Expected: the tray is still collapsed (read from `localStorage` via `normalize`).

- [ ] **Step 7: Verify drag-refile still works**

Drag an item from one section and drop it onto another section.
Expected: item moves to that tray; its row shows the new tray in the move-select; reload keeps it there.

- [ ] **Step 8: Commit**

```bash
git add sift/src/components/Board.jsx sift/src/components/Tray.jsx sift/src/App.jsx sift/src/styles.css
git commit -m "feat: vertical collapsible tray sections (drop kanban grid + swipe pager)"
```

---

### Task 3: Readable single-line item rows (ItemCard + row CSS)

**Files:**
- Modify: `sift/src/components/ItemCard.jsx` (full replace)
- Modify: `sift/src/styles.css` (card/row + hover actions)

**Interfaces:**
- Consumes: `onToggleDone`, `onRefile`, `onRemove`, `onEdit` (unchanged signatures).
- Produces: card is a single flex row; the `.cardtext` button is the drag handle; `.acts` (move-select + delete) reveal on hover/focus on desktop and are hidden on touch (EditSheet covers those on mobile).

- [ ] **Step 1: Replace `sift/src/components/ItemCard.jsx`** (tilt + footer removed):

```jsx
import { useDraggable } from "@dnd-kit/core";
import { dueLabel, repeatLabel } from "../lib/dates.js";

export default function ItemCard({ item, categories, onToggleDone, onRefile, onRemove, onEdit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const label = dueLabel(item);
  const overdue = !item.done && item.due != null && item.due < Date.now();
  return (
    <article
      ref={setNodeRef}
      className={"card" + (item.done ? " done" : "") + (isDragging ? " dragging" : "")}
    >
      <button className="check" onClick={() => onToggleDone(item.id)} aria-label={item.done ? "Mark not done" : "Mark done"}>
        {item.done ? "■" : "□"}
      </button>
      <button className="cardtext" {...attributes} {...listeners} onClick={() => onEdit(item.id)} title="Edit / drag to move">
        {item.text}
      </button>
      {label && <span className={"duechip" + (overdue ? " over" : "") + (item.vague ? " vague" : "")}>{label}</span>}
      {item.repeat && <span className="repglyph">{repeatLabel(item.repeat)}</span>}
      <span className="acts">
        <select value={item.catId} onChange={(e) => onRefile(item.id, e.target.value)} aria-label="Move item" title="Move">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="x" onClick={() => onRemove(item.id)} aria-label="Delete item">×</button>
      </span>
    </article>
  );
}
```

- [ ] **Step 2: Rework card CSS in `sift/src/styles.css`.**

(a) Replace the `.card` rule (lines ~307-314) — remove tilt, make it a row:

```css
.card {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--line);
  background: var(--card);
  padding: 8px 11px;
  margin-bottom: 8px;
  animation: drop 0.2s ease;
  touch-action: manipulation;
}
```

(b) The old `.card-row`, `.card p`, `.card footer`, `.meta`, and `.card-row p` rules (lines ~319, 332, 334, 336, 422-423) are now unused — delete them. Keep `.check`, `.duechip`, `.repglyph`, `.acts select`, `.x`.

(c) Replace `.cardtext` (lines ~427-439) — it is now an inline flex cell + drag handle:

```css
.cardtext {
  font-family: var(--sans);
  font-size: 14.5px;
  line-height: 1.4;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  color: var(--ink);
  text-align: left;
  cursor: grab;
  flex: 1;
  min-width: 0;
}
.cardtext:active { cursor: grabbing; }
```

(d) Replace the `.acts` rule (line ~338) with hover-reveal (desktop) / hidden (touch):

```css
.acts {
  margin-left: auto;
  display: flex;
  gap: 6px;
  align-items: center;
  flex: none;
  opacity: 0;
  transition: opacity 0.1s;
}
.card:hover .acts,
.card:focus-within .acts { opacity: 1; }
@media (hover: none) { .acts { display: none; } }
```

(e) Update the drop animation `@keyframes drop` (lines ~373-376) to remove the tilt reference:

```css
@keyframes drop {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: none; }
}
```

- [ ] **Step 3: Verify in browser**

Run app. Expected: each item is one tidy line — `□ text  [due]  [repeat]`; rows are flat and aligned, no random tilt. Hover a row (desktop) → the move-select + × fade in; move away → they fade out. Tap the text → EditSheet opens. Toggle the checkbox → done styling (strikethrough, dimmed). On a touch viewport the inline actions are hidden (use EditSheet).

- [ ] **Step 4: Confirm done styling still applies** — the `.card.done` rules target `.cardtext`; verify a done item shows line-through and `opacity: 0.55`.

- [ ] **Step 5: Commit**

```bash
git add sift/src/components/ItemCard.jsx sift/src/styles.css
git commit -m "feat: single-line readable item rows, hover-revealed actions, no tilt"
```

---

### Task 4: Go flat — remove all shadows

**Files:**
- Modify: `sift/src/styles.css`

**Interfaces:**
- Produces: no `box-shadow` anywhere; button press feedback is a 1px nudge instead of a collapsing shadow; drag overlay reads as "lifted" via a heavier ink border.

- [ ] **Step 1: Remove every `box-shadow` declaration.** Delete the `box-shadow:` line from each of these rules:
  - `.capture input` (~line 86)
  - `.btn` (~line 103)
  - `.trace` (~line 150)
  - `.tray` (~line 239)
  - `.toast` (~line 354)
  - `.sheet` (~line 466)
  - the `@media (max-width: 640px) .capture input` already sets `box-shadow: none` (~line 399) — leave or remove, harmless.

- [ ] **Step 2: Flatten the button press** — replace `.btn:active` (line ~107):

```css
.btn:active { transform: translateY(1px); }
```

- [ ] **Step 3: Flatten the EditSheet on desktop** — in `.sheet` the `box-shadow` is gone; no other change needed (the mobile `.sheet` already sets `box-shadow: none`).

- [ ] **Step 4: Re-style the drag proof** — replace `.dragproof .card` (lines ~532-537) so the lifted card reads without a shadow:

```css
.dragproof .card {
  border: 1.5px solid var(--ink);
  cursor: grabbing;
  animation: none;
}
```

- [ ] **Step 5: Verify in browser**

Run app. Expected: nothing casts a hard offset shadow — capture bar, buttons, trays, toast, edit sheet all sit flat on the paper, separated only by borders + the colored top-bar. Press a button → it nudges down 1px (no sideways jump). Drag a card → the floating proof shows a crisp ink border, no shadow. Toggle dark theme → still flat, borders visible.

- [ ] **Step 6: Commit**

```bash
git add sift/src/styles.css
git commit -m "feat: flat design — remove all drop shadows, nudge-based button press"
```

---

### Task 5: Ledger entry + end-to-end gate

**Files:**
- Modify: `features.json`

**Interfaces:**
- Consumes: everything above.
- Produces: `todo-list-layout` feature recorded and verified.

- [ ] **Step 1: Add the feature (passes:false)** — insert into the `features` array of `features.json`, after the `theme-cycle` entry:

```json
    { "id": "todo-list-layout", "category": "ui",
      "description": "Trays render as one vertical column of collapsible sections (fold persists across reload); flat design with no drop shadows; item rows are single-line and readable",
      "steps": ["Run app", "Verify trays stack vertically (no column grid, no mobile swipe pager)", "Collapse a tray via its caret", "Reload", "Verify it stayed collapsed", "Drag an item onto another section", "Verify it refiled and the move persists", "Confirm no box-shadow anywhere (and on mobile width it is the same vertical list)"],
      "passes": false },
```

- [ ] **Step 2: Run the full unit suite**

Run: `cd sift && npm test`
Expected: `Test Files 3 passed (3)`, `Tests 43 passed (43)` (41 prior + 2 from Task 1).

- [ ] **Step 3: Run the feature's steps in the browser** (real human pass): vertical stack ✓, fold + reload-persist ✓, drag-refile + persist ✓, no shadows ✓, narrow viewport = same vertical list ✓.

- [ ] **Step 4: Flip to passes:true** only after Step 3 passes — change the entry's `"passes": false` to `"passes": true`.

- [ ] **Step 5: Commit**

```bash
git add features.json
git commit -m "chore: verify todo-list-layout e2e, mark passes:true (43/43 tests)"
```

---

## Self-Review

**Spec coverage:**
- Layout = vertical collapsible sections → Task 2. ✓
- Section header caret/fold → Task 2 (Tray). ✓
- Fold persists → Task 1 (store) + Task 2 (App handler). ✓
- Readable single-line rows, hover/EditSheet actions → Task 3. ✓
- Remove all shadows + flat press → Task 4. ✓
- Drag-to-refile kept → Task 2 Step 7 verifies. ✓
- Mobile = same vertical list (kill pager) → Task 2 Step 4d + Step 5. ✓
- Ledger entry + e2e gate → Task 5. ✓
- Out of scope (item reorder, native-reminder-sync) → untouched. ✓

**Placeholder scan:** none — every code/CSS step shows concrete content.

**Type consistency:** `onToggleCollapse(catId)` defined in App (Task 2 Step 1), passed Board→Tray with the same name (Task 2 Steps 2-3), consumed in Tray's `onClick`. `cat.collapsed` written by `normalize` (Task 1) and App toggle (Task 2), read in Tray (Task 2). `.acts`, `.cardtext`, `.fold`, `.tray.collapsed` classes are defined in CSS (Tasks 2-3) and used in JSX (Tasks 2-3). Consistent.
