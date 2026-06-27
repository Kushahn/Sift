# Sift Personal Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Sift into a polished, personal-only, phone-first organizer: due dates parsed from text, item editing, repeatable tasks, mobile reminders, drag-and-drop refiling, dark mode, mobile swipe pager, and a stats strip.

**Architecture:** Single React state tree in `App.jsx` (`{categories, items, theme}`) persisted to localStorage via `lib/store.js`. Pure logic lives in `lib/` (dates, store, notify) behind small tested interfaces; UI is split into focused components receiving props. Capacitor provides native scheduled notifications on Android; web gets best-effort notifications while open. The rule-based classifier stays untouched as the single AI swap point.

**Tech Stack:** Vite 5, React 18, `@dnd-kit/core`, `@capacitor/local-notifications@^6` (matches Capacitor 6), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-sift-enhancement-design.md` (v2, approved).

**Working directory:** all `npm`/build commands run in `sift/` (the app root inside the repo). Git commands run at repo root. Work on branch `dev`; never commit to `main` (hook-enforced).

---

## File Structure

```
sift/src/
  App.jsx                    MODIFY  state owner + composition (flat personal model)
  components/                CREATE  (new directory)
    Capture.jsx              CREATE  input + route button + example chips
    Trace.jsx                CREATE  routing receipt
    PendingSlip.jsx          CREATE  new-tray suggestion
    Toolbar.jsx              CREATE  filter, +tray, sort toggle, export/import/reset
    Board.jsx                CREATE  DnD context; desktop grid / mobile snap-pager + tabs
    Tray.jsx                 CREATE  droppable tray, local rename state
    ItemCard.jsx             CREATE  draggable card + date chip + repeat glyph
    EditSheet.jsx            CREATE  edit item: text, due, repeat, tray, reminder, delete
    StatsStrip.jsx           CREATE  captured/done/streak
    Toast.jsx                CREATE  toast with optional undo
  lib/
    classifier.js            UNCHANGED (tests added)
    classifier.test.js       CREATE
    store.js                 REWRITE personal-only + migration + inkFor
    store.test.js            CREATE
    dates.js                 CREATE  parseDue, dueLabel, nextOccurrence, repeatLabel
    dates.test.js            CREATE
    notify.js                CREATE  reminder scheduling (native/web)
  styles.css                 MODIFY  additions per feature; riso identity preserved
sift/index.html              MODIFY  pre-paint theme script
sift/public/sw.js            MODIFY  cache bump sift-v2
sift/package.json            MODIFY  deps + test script
sift/README.md               REWRITE
```

---

### Task 1: Test infrastructure + `lib/dates.js` (TDD)

**Files:**
- Modify: `sift/package.json`
- Test: `sift/src/lib/dates.test.js`
- Create: `sift/src/lib/dates.js`

- [ ] **Step 1: Install vitest**

Run: `cd sift && npm i -D vitest`
Expected: added to devDependencies without errors.

- [ ] **Step 2: Add test script**

In `sift/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write the failing tests**

Create `sift/src/lib/dates.test.js`:

```js
import { describe, it, expect } from "vitest";
import { parseDue, dueLabel, nextOccurrence, repeatLabel } from "./dates.js";

const NOW = new Date(2026, 5, 11, 12, 0); // Thursday, June 11 2026, 12:00 local
const at = (y, mo, d, h = 0, min = 0) => new Date(y, mo, d, h, min).getTime();

describe("parseDue", () => {
  it("returns null when nothing matches", () => {
    expect(parseDue("buy milk", NOW)).toBeNull();
  });
  it("parses tomorrow (date only -> end of day, no time)", () => {
    const r = parseDue("submit report tomorrow", NOW);
    expect(r.due).toBe(at(2026, 5, 12, 23, 59));
    expect(r.hasTime).toBe(false);
    expect(r.vague).toBe(false);
  });
  it("parses weekday + time", () => {
    const r = parseDue("dentist friday 3pm", NOW);
    expect(r.due).toBe(at(2026, 5, 12, 15, 0));
    expect(r.hasTime).toBe(true);
  });
  it("same weekday means next week (strictly after today)", () => {
    expect(parseDue("review thursday", NOW).due).toBe(at(2026, 5, 18, 23, 59));
  });
  it("does not treat words containing weekday letters as dates", () => {
    expect(parseDue("buy a monitor", NOW)).toBeNull();
    expect(parseDue("meet a friend", NOW)).toBeNull();
  });
  it("parses tonight as 20:00 today", () => {
    const r = parseDue("call mom tonight", NOW);
    expect(r.due).toBe(at(2026, 5, 11, 20, 0));
    expect(r.hasTime).toBe(true);
  });
  it("parses month-day, rolling to next year when past", () => {
    expect(parseDue("renew jan 5", NOW).due).toBe(at(2027, 0, 5, 23, 59));
    expect(parseDue("party jun 15", NOW).due).toBe(at(2026, 5, 15, 23, 59));
    expect(parseDue("15 june picnic", NOW).due).toBe(at(2026, 5, 15, 23, 59));
  });
  it("time alone means today", () => {
    expect(parseDue("standup 15:30", NOW).due).toBe(at(2026, 5, 11, 15, 30));
    expect(parseDue("call at 3", NOW).due).toBe(at(2026, 5, 11, 15, 0)); // bare hour -> afternoon
  });
  it("vague future phrases produce SOMEDAY with no timestamp", () => {
    for (const t of ["learn piano in the future", "someday visit japan", "eventually fix this", "do it later"]) {
      const r = parseDue(t, NOW);
      expect(r.vague).toBe(true);
      expect(r.due).toBeNull();
    }
  });
});

describe("dueLabel", () => {
  it("labels relative and absolute days", () => {
    expect(dueLabel({ due: at(2026, 5, 11, 23, 59), hasTime: false }, NOW)).toBe("TODAY");
    expect(dueLabel({ due: at(2026, 5, 12, 15, 0), hasTime: true }, NOW)).toBe("TMRW 3PM");
    expect(dueLabel({ due: at(2026, 5, 14, 23, 59), hasTime: false }, NOW)).toBe("SUN");
    expect(dueLabel({ due: at(2026, 5, 25, 23, 59), hasTime: false }, NOW)).toBe("JUN 25");
    expect(dueLabel({ due: at(2026, 5, 12, 9, 30), hasTime: true }, NOW)).toBe("TMRW 9:30AM");
    expect(dueLabel({ vague: true, due: null }, NOW)).toBe("SOMEDAY");
    expect(dueLabel({ due: null, vague: false }, NOW)).toBeNull();
  });
});

describe("nextOccurrence", () => {
  const now = NOW.getTime();
  it("advances by the cycle", () => {
    expect(nextOccurrence(at(2026, 5, 11, 15, 0), { every: 1, unit: "day" }, now)).toBe(at(2026, 5, 12, 15, 0));
    expect(nextOccurrence(at(2026, 5, 11, 15, 0), { every: 2, unit: "week" }, now)).toBe(at(2026, 5, 25, 15, 0));
  });
  it("clamps month-end (Jan 31 + 1 month = Feb 28)", () => {
    expect(nextOccurrence(at(2026, 0, 31, 9, 0), { every: 1, unit: "month" }, at(2026, 0, 31, 10, 0)))
      .toBe(at(2026, 1, 28, 9, 0));
  });
  it("clamps leap day on yearly", () => {
    expect(nextOccurrence(at(2028, 1, 29, 9, 0), { every: 1, unit: "year" }, at(2028, 1, 29, 10, 0)))
      .toBe(at(2029, 1, 28, 9, 0));
  });
  it("catches up long-overdue repeats to the first future occurrence", () => {
    expect(nextOccurrence(at(2026, 5, 1, 23, 59), { every: 1, unit: "day" }, now)).toBe(at(2026, 5, 11, 23, 59));
  });
  it("uses now as base when the item had no due date", () => {
    expect(nextOccurrence(null, { every: 1, unit: "week" }, now)).toBe(at(2026, 5, 18, 12, 0));
  });
});

describe("repeatLabel", () => {
  it("formats cycles compactly", () => {
    expect(repeatLabel({ every: 1, unit: "day" })).toBe("↻1D");
    expect(repeatLabel({ every: 2, unit: "week" })).toBe("↻2W");
    expect(repeatLabel(null)).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd sift && npm test`
Expected: FAIL — cannot resolve `./dates.js`.

- [ ] **Step 5: Implement `sift/src/lib/dates.js`**

```js
// Due-date parsing + repeat arithmetic. Pure functions, no DOM.

const DAY = 86_400_000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WD_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const VAGUE_RX = /\b(in the future|someday|eventually|later)\b/i;
const WD_RX = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i;
const MD_RX = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i;
const DM_RX = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const TIME_RX = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b|\bat\s+(\d{1,2})\b/i;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function to24h(hours, ampm) {
  let h = hours;
  if (ampm && /pm/i.test(ampm) && h < 12) h += 12;
  if (ampm && /am/i.test(ampm) && h === 12) h = 0;
  return h;
}

function parseTime(text) {
  const m = text.match(TIME_RX);
  if (!m) return null;
  if (m[1] !== undefined) return { h: to24h(+m[1], m[3]), min: +m[2] };
  if (m[4] !== undefined) return { h: to24h(+m[4], m[5]), min: 0 };
  const h = +m[6];
  return { h: h < 8 ? h + 12 : h, min: 0 }; // bare "at 3" -> assume afternoon
}

function parseDay(text, now) {
  if (/\btomorrow\b/i.test(text)) return { day: startOfDay(new Date(now.getTime() + DAY)) };
  if (/\btonight\b/i.test(text)) return { day: startOfDay(now), eveningDefault: true };
  if (/\btoday\b/i.test(text)) return { day: startOfDay(now) };
  const wd = text.match(WD_RX);
  if (wd) {
    const target = WD_ABBR.indexOf(wd[1].slice(0, 3).toUpperCase());
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0) delta = 7; // strictly after today
    return { day: startOfDay(new Date(now.getTime() + delta * DAY)) };
  }
  const md = text.match(MD_RX);
  const dm = md ? null : text.match(DM_RX);
  if (md || dm) {
    const mon = MONTHS.indexOf((md ? md[1] : dm[2]).slice(0, 3).toLowerCase());
    const dayNum = +(md ? md[2] : dm[1]);
    let d = new Date(now.getFullYear(), mon, dayNum);
    if (startOfDay(d) < startOfDay(now)) d = new Date(now.getFullYear() + 1, mon, dayNum);
    return { day: startOfDay(d) };
  }
  return null;
}

export function parseDue(text, now = new Date()) {
  if (VAGUE_RX.test(text)) return { due: null, hasTime: false, vague: true };
  const time = parseTime(text);
  const dayHit = parseDay(text, now);
  if (!time && !dayHit) return null;
  const d = new Date(dayHit ? dayHit.day : startOfDay(now));
  if (time) d.setHours(time.h, time.min, 0, 0);
  else if (dayHit && dayHit.eveningDefault) d.setHours(20, 0, 0, 0);
  else d.setHours(23, 59, 0, 0); // date only — due at end of day
  return { due: d.getTime(), hasTime: !!time || !!(dayHit && dayHit.eveningDefault), vague: false };
}

export function dueLabel(it, now = new Date()) {
  if (it.vague) return "SOMEDAY";
  if (it.due == null) return null;
  const d = new Date(it.due);
  const t0 = startOfDay(now).getTime();
  const td = startOfDay(d).getTime();
  let day;
  if (td === t0) day = "TODAY";
  else if (td === t0 + DAY) day = "TMRW";
  else if (td > t0 && td < t0 + 7 * DAY) day = WD_ABBR[d.getDay()];
  else day = `${MONTHS[d.getMonth()].toUpperCase()} ${d.getDate()}`;
  if (!it.hasTime) return day;
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const ap = d.getHours() < 12 ? "AM" : "PM";
  const mm = d.getMinutes();
  return `${day} ${h12}${mm ? ":" + String(mm).padStart(2, "0") : ""}${ap}`;
}

// Advances due by the repeat cycle, repeating until the result is in the
// future (catch-up for long-overdue items). Month/year arithmetic clamps to
// the last valid day; a clamped day stays clamped on later cycles (standard
// to-do-app tradeoff).
export function nextOccurrence(due, repeat, now = Date.now()) {
  const d = new Date(due != null ? due : now);
  const advance = () => {
    const n = repeat.every;
    if (repeat.unit === "day") d.setDate(d.getDate() + n);
    else if (repeat.unit === "week") d.setDate(d.getDate() + 7 * n);
    else if (repeat.unit === "month") {
      const dayNum = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dayNum, last));
    } else {
      const mon = d.getMonth();
      d.setFullYear(d.getFullYear() + n);
      if (d.getMonth() !== mon) d.setDate(0); // Feb 29 -> Feb 28
    }
  };
  let guard = 0;
  do { advance(); } while (d.getTime() <= now && ++guard < 1000);
  return d.getTime();
}

export function repeatLabel(repeat) {
  if (!repeat) return null;
  const u = { day: "D", week: "W", month: "M", year: "Y" }[repeat.unit];
  return `↻${repeat.every}${u}`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd sift && npm test`
Expected: PASS — all dates tests green.

- [ ] **Step 7: Commit**

```bash
git add sift/package.json sift/package-lock.json sift/src/lib/dates.js sift/src/lib/dates.test.js
git commit -m "feat: add due-date parser and repeat arithmetic with vitest"
```

---

### Task 2: Classifier sanity tests (no production change)

**Files:**
- Test: `sift/src/lib/classifier.test.js`

- [ ] **Step 1: Write the tests** (these should pass immediately — they pin existing behavior)

Create `sift/src/lib/classifier.test.js`:

```js
import { describe, it, expect } from "vitest";
import { classify, suggestName, POLICY } from "./classifier.js";

const CATS = [
  { id: "tasks", name: "Tasks", lexicon: "tasks" },
  { id: "events", name: "Schedule", lexicon: "events" },
  { id: "custom", name: "Garden", words: ["garden", "plant"] },
];

describe("classify", () => {
  it("survives an empty category list", () => {
    const r = classify("anything", []);
    expect(r.best).toBeNull();
    expect(r.confidence).toBe(0);
  });
  it("routes a scheduled meeting to events confidently", () => {
    const r = classify("team sync tomorrow at 10am", CATS);
    expect(r.best.cat.id).toBe("events");
    expect(r.confidence).toBeGreaterThanOrEqual(POLICY.ask);
  });
  it("matches custom tray words only on word boundaries", () => {
    expect(classify("plant the garden bed", CATS).best.cat.id).toBe("custom");
    expect(classify("supplant the gardener", CATS).confidence).toBe(0);
  });
  it("policy thresholds are ordered", () => {
    expect(POLICY.auto).toBeGreaterThan(POLICY.ask);
  });
});

describe("suggestName", () => {
  it("picks the longest non-stopword", () => {
    expect(suggestName("quantum sandwich logistics")).toBe("Logistics");
  });
  it("falls back to misc", () => {
    expect(suggestName("the and for")).toBe("Misc");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd sift && npm test`
Expected: PASS. If `suggestName` fallback test fails because capitalization differs, fix the TEST to match actual output — these tests pin current behavior, they don't change it.

- [ ] **Step 3: Commit**

```bash
git add sift/src/lib/classifier.test.js
git commit -m "test: pin classifier guard, confidence, and boundary behavior"
```

---

### Task 3: `store.js` — personal-only flat model, migration, night inks (TDD)

**Files:**
- Test: `sift/src/lib/store.test.js`
- Rewrite: `sift/src/lib/store.js`

Note: after this task `App.jsx` still imports the old store API and the app will not build until Task 4. That is expected — Tasks 3+4 land as consecutive commits on `dev`; only run the dev server after Task 4.

- [ ] **Step 1: Write the failing tests**

Create `sift/src/lib/store.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { normalize, load, freshSeeds, inkFor, RISO } from "./store.js";

function mockStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

beforeEach(() => { globalThis.localStorage = mockStorage(); });

const OLD_SHAPE = {
  active: "personal",
  workspaces: {
    personal: {
      categories: [{ id: "tasks", name: "Tasks", lexicon: "tasks", color: "#00A95C" }],
      items: [{ id: "a1", catId: "tasks", text: "old item", conf: 50, ts: "earlier", done: false }],
    },
    corporate: { categories: [{ id: "b", name: "Brainstorm" }], items: [] },
  },
};

describe("normalize", () => {
  it("lifts the personal workspace from the old two-workspace shape", () => {
    const s = normalize(OLD_SHAPE);
    expect(s.items[0].text).toBe("old item");
    expect(s.categories).toHaveLength(1);
    expect(s.theme).toBe("auto");
    expect(s.workspaces).toBeUndefined();
  });
  it("defaults all new item fields additively", () => {
    expect(normalize(OLD_SHAPE).items[0]).toMatchObject({
      due: null, hasTime: false, vague: false, repeat: null,
      remind: false, created: null, doneAt: null, notifiedAt: null,
    });
  });
  it("accepts the new flat shape unchanged", () => {
    expect(normalize(freshSeeds()).categories).toHaveLength(4);
  });
  it("keeps an explicit theme", () => {
    expect(normalize({ ...freshSeeds(), theme: "dark" }).theme).toBe("dark");
  });
  it("throws on garbage", () => {
    expect(() => normalize({ nope: true })).toThrow();
  });
});

describe("load", () => {
  it("backs up the old blob (incl. corporate) before migrating", () => {
    localStorage.setItem("sift.v1", JSON.stringify(OLD_SHAPE));
    const s = load();
    expect(s.items[0].text).toBe("old item");
    const backup = JSON.parse(localStorage.getItem("sift.v1.backup"));
    expect(backup.workspaces.corporate.categories[0].name).toBe("Brainstorm");
  });
  it("falls back to seeds on corrupted storage", () => {
    localStorage.setItem("sift.v1", "{not json");
    expect(load().categories).toHaveLength(4);
  });
});

describe("inkFor", () => {
  it("maps riso inks to fluorescent night inks in dark theme only", () => {
    expect(inkFor(RISO.red, "dark")).toBe("#FF48B0");
    expect(inkFor(RISO.red, "light")).toBe(RISO.red);
    expect(inkFor("#123456", "dark")).toBe("#123456"); // unknown passes through
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sift && npm test`
Expected: FAIL — `normalize`/`inkFor` not exported.

- [ ] **Step 3: Rewrite `sift/src/lib/store.js`**

```js
// Persistence + seeds + ink palettes. Personal-only flat model.
// Old two-workspace saves are lifted to the flat shape; the original blob is
// backed up to sift.v1.backup first so corporate data survives for the
// future corporate app.

const KEY = "sift.v1";
const BACKUP_KEY = "sift.v1.backup";

export const RISO = {
  blue: "#0078BF", red: "#F15060", green: "#00A95C", sunflower: "#FFB511",
  violet: "#9D7AD2", orange: "#FF6C2F", teal: "#00838A", federal: "#3D5588",
};

export const TRAY_COLORS = Object.values(RISO);

// fluorescent night-print counterparts, keyed by light ink hex
const NIGHT_INK = {
  "#0078BF": "#4FC3F7", "#F15060": "#FF48B0", "#00A95C": "#5EFC8D",
  "#FFB511": "#FFD54F", "#9D7AD2": "#C9A0FF", "#FF6C2F": "#FF8A50",
  "#00838A": "#4DD0E1", "#3D5588": "#7E9BFF",
};

export const inkFor = (hex, theme) => (theme === "dark" ? NIGHT_INK[hex] || hex : hex);

const ITEM_DEFAULTS = {
  conf: null, done: false, due: null, hasTime: false, vague: false,
  repeat: null, remind: false, created: null, doneAt: null, notifiedAt: null,
};

export function normalize(data) {
  if (!data) throw new Error("bad shape");
  const src = data.workspaces ? data.workspaces.personal : data;
  if (!src || !Array.isArray(src.categories) || !Array.isArray(src.items)) throw new Error("bad shape");
  return {
    categories: src.categories,
    items: src.items.map((it) => ({ ...ITEM_DEFAULTS, ...it })),
    theme: data.theme === "light" || data.theme === "dark" ? data.theme : "auto",
  };
}

export function freshSeeds() {
  const now = Date.now();
  return {
    theme: "auto",
    categories: [
      { id: "tasks", name: "Tasks", lexicon: "tasks", color: RISO.green },
      { id: "ideas", name: "Ideas", lexicon: "ideas", color: RISO.violet },
      { id: "plans", name: "Plans", lexicon: "plans", color: RISO.blue },
      { id: "events", name: "Schedule", lexicon: "events", color: RISO.sunflower },
    ],
    items: [
      { ...ITEM_DEFAULTS, id: "s1", catId: "tasks", text: "Submit the lab report before Friday", conf: 64, ts: "earlier", created: now },
      { ...ITEM_DEFAULTS, id: "s2", catId: "ideas", text: "What if flashcards generated themselves from lecture notes", conf: 71, ts: "earlier", created: now },
      { ...ITEM_DEFAULTS, id: "s3", catId: "events", text: "Dentist appointment Tuesday at 4pm", conf: 88, ts: "earlier", created: now },
    ],
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.workspaces) {
        try { localStorage.setItem(BACKUP_KEY, raw); } catch { /* backup is best-effort */ }
      }
      return normalize(data);
    }
  } catch { /* corrupted storage — fall through to seeds */ }
  return freshSeeds();
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { /* storage full or unavailable — app keeps working in memory */ }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sift && npm test`
Expected: PASS — store, dates, classifier suites all green.

- [ ] **Step 5: Commit**

```bash
git add sift/src/lib/store.js sift/src/lib/store.test.js
git commit -m "feat: personal-only flat store with backup migration and night inks"
```

---

### Task 4: Flat personal model in the UI + component split

**Files:**
- Rewrite: `sift/src/App.jsx`
- Create: `sift/src/components/` — `Capture.jsx`, `Trace.jsx`, `PendingSlip.jsx`, `Toolbar.jsx`, `ItemCard.jsx`, `Tray.jsx`, `Board.jsx`, `Toast.jsx`
- Modify: `sift/src/styles.css` (remove edition-toggle rules)

No behavior change beyond removing the Corporate edition. All components below are complete files.

- [ ] **Step 1: Create `sift/src/components/Capture.jsx`**

```jsx
const EXAMPLES = ["dentist friday at 3pm", "what if alarms snoozed themselves", "fix the squeaky door", "quantum sandwich logistics"];

export default function Capture({ input, setInput, onRoute, inputRef }) {
  return (
    <>
      <div className="capture">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onRoute()}
          placeholder="buy a power strip… what if… dentist friday 3pm…"
          aria-label="Capture input"
          enterKeyHint="send"
        />
        <button className="btn go" onClick={onRoute}>route it</button>
      </div>
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => { setInput(ex); inputRef.current?.focus(); }}>
            {ex}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `sift/src/components/Trace.jsx`**

```jsx
export default function Trace({ trace, asking, onDismiss }) {
  const maxScore = Math.max(1, ...trace.res.rows.map((r) => r.score));
  return (
    <div className="trace" aria-live="polite">
      <div className="tr-top">
        <span>ROUTING TRACE · "{trace.text}"</span>
        <button className="x" onClick={onDismiss} aria-label="Dismiss trace">×</button>
      </div>
      {trace.res.rows.map((r) => (
        <div className="tr-row" key={r.cat.id}>
          <span className="tr-name">{r.cat.name}</span>
          <span className="tr-bar">
            <span style={{ width: (r.score / maxScore) * 100 + "%", background: r.cat.color }} />
          </span>
          <span className="tr-score">{r.score.toFixed(1)}</span>
          <span className="tr-match">{r.matched.length ? r.matched.map((m) => `'${m}'`).join(" ") : "·"}</span>
        </div>
      ))}
      <div className="tr-verdict">
        {asking
          ? "→ no confident match — asking the operator"
          : `→ filed under ${trace.res.best.cat.name} · ${trace.res.confidence}% confident`}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `sift/src/components/PendingSlip.jsx`**

```jsx
export default function PendingSlip({ pending, setPending, categories, onCreate, onFileUnder, onDiscard }) {
  return (
    <div className="suggest">
      <div className="sg-text">
        Nothing fits <b>"{pending.text}"</b>. New tray?
      </div>
      <div className="sg-row">
        <input
          value={pending.name}
          onChange={(e) => setPending({ ...pending, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onCreate(pending.name)}
          aria-label="New tray name"
        />
        <button className="btn" onClick={() => onCreate(pending.name)}>
          create "{pending.name.trim() || "…"}"
        </button>
        <select value="" onChange={(e) => onFileUnder(e.target.value)} aria-label="File under existing tray">
          <option value="" disabled>…or file under</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="ghost" onClick={onDiscard}>discard</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `sift/src/components/Toolbar.jsx`** (owns its own new-tray input state)

```jsx
import { useRef, useState } from "react";

export default function Toolbar({ query, setQuery, onAddTray, onExport, onImport, onReset }) {
  const [newTray, setNewTray] = useState(null);
  const fileRef = useRef(null);

  function commit() {
    const name = (newTray || "").trim();
    if (name) onAddTray(name);
    setNewTray(null);
  }

  return (
    <div className="toolbar">
      <input
        className="filter"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="filter items…"
        aria-label="Filter items"
      />
      <span className="spacer" />
      {newTray === null ? (
        <button className="ghost" onClick={() => setNewTray("")}>+ tray</button>
      ) : (
        <span className="newtray">
          <input
            autoFocus
            value={newTray}
            onChange={(e) => setNewTray(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setNewTray(null);
            }}
            placeholder="tray name"
            aria-label="New tray name"
          />
          <button className="btn" onClick={commit}>add</button>
        </span>
      )}
      <button className="ghost" onClick={onExport}>export</button>
      <button className="ghost" onClick={() => fileRef.current?.click()}>import</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }}
        hidden
      />
      <button className="ghost danger" onClick={onReset}>reset</button>
    </div>
  );
}
```

- [ ] **Step 5: Create `sift/src/components/ItemCard.jsx`**

```jsx
// deterministic tiny tilt per item, like cards dropped into a tray
function tilt(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ((h % 5) - 2) * 0.35 + "deg";
}

export default function ItemCard({ item, categories, onToggleDone, onRefile, onRemove }) {
  return (
    <article className={"card" + (item.done ? " done" : "")} style={{ "--tilt": tilt(item.id) }}>
      <div className="card-row">
        <button className="check" onClick={() => onToggleDone(item.id)} aria-label={item.done ? "Mark not done" : "Mark done"}>
          {item.done ? "■" : "□"}
        </button>
        <p>{item.text}</p>
      </div>
      <footer>
        <span className="meta">
          {item.ts} · {item.conf == null ? "manual" : item.conf + "%"}
          {item.refiled ? " · refiled" : ""}
        </span>
        <span className="acts">
          <select value={item.catId} onChange={(e) => onRefile(item.id, e.target.value)} aria-label="Move item">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="x" onClick={() => onRemove(item.id)} aria-label="Delete item">×</button>
        </span>
      </footer>
    </article>
  );
}
```

- [ ] **Step 6: Create `sift/src/components/Tray.jsx`** (owns its rename state)

```jsx
import { useState } from "react";
import ItemCard from "./ItemCard.jsx";

export default function Tray({ cat, items, categories, canDelete, onRename, onDelete, onToggleDone, onRefile, onRemove }) {
  const [editName, setEditName] = useState(null);

  function commitRename() {
    const name = (editName || "").trim();
    if (name) onRename(cat.id, name);
    setEditName(null);
  }

  return (
    <section className="tray" style={{ "--c": cat.color }}>
      <header className="tray-head">
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

      {items.length === 0 && <div className="empty">empty — type above</div>}

      {items.map((it) => (
        <ItemCard key={it.id} item={it} categories={categories}
          onToggleDone={onToggleDone} onRefile={onRefile} onRemove={onRemove} />
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Create `sift/src/components/Board.jsx`**

```jsx
import Tray from "./Tray.jsx";

export default function Board({ categories, items, canDelete, onRenameTray, onDeleteTray, onToggleDone, onRefile, onRemove }) {
  return (
    <div className="board">
      {categories.map((c) => (
        <Tray
          key={c.id}
          cat={c}
          items={items.filter((it) => it.catId === c.id)}
          categories={categories}
          canDelete={canDelete}
          onRename={onRenameTray}
          onDelete={onDeleteTray}
          onToggleDone={onToggleDone}
          onRefile={onRefile}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Create `sift/src/components/Toast.jsx`**

```jsx
export default function Toast({ toast, onUndo }) {
  return (
    <div className="toast" role="status">
      {toast.text}
      {toast.undoId && (
        <button className="btn small" onClick={() => onUndo(toast.undoId)}>undo</button>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Rewrite `sift/src/App.jsx`** (flat model, no Corporate edition)

```jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { classify, suggestName, POLICY } from "./lib/classifier.js";
import { load, save, freshSeeds, normalize, TRAY_COLORS } from "./lib/store.js";
import Capture from "./components/Capture.jsx";
import Trace from "./components/Trace.jsx";
import PendingSlip from "./components/PendingSlip.jsx";
import Toolbar from "./components/Toolbar.jsx";
import Board from "./components/Board.jsx";
import Toast from "./components/Toast.jsx";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const stamp = () =>
  new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const RegMark = () => (
  <svg className="regmark" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 0v20 M0 10h20" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const newItem = (text, catId, conf) => ({
  id: uid(), catId, text, conf, ts: stamp(), done: false, created: Date.now(),
  due: null, hasTime: false, vague: false, repeat: null, remind: false, doneAt: null, notifiedAt: null,
});

export default function App() {
  const [data, setData] = useState(load);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [trace, setTrace] = useState(null);     // { text, res }
  const [pending, setPending] = useState(null); // { text, name }
  const [toast, setToast] = useState(null);     // { text, undoId? }
  const inputRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => save(data), [data]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.items.filter((it) => it.text.toLowerCase().includes(q)) : data.items;
  }, [data.items, query]);

  function pushToast(next) {
    clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  // ---- capture & routing -------------------------------------------------

  function route() {
    const text = input.trim();
    if (!text) return;
    const res = classify(text, data.categories);
    setTrace({ text, res });
    setPending(null);
    if (res.confidence >= POLICY.auto) {
      setData((d) => ({ ...d, items: [newItem(text, res.best.cat.id, res.confidence), ...d.items] }));
    } else if (res.confidence >= POLICY.ask) {
      const item = newItem(text, res.best.cat.id, res.confidence);
      setData((d) => ({ ...d, items: [item, ...d.items] }));
      pushToast({ text: `filed under ${res.best.cat.name} · ${res.confidence}% sure`, undoId: item.id });
    } else {
      setPending({ text, name: suggestName(text) });
    }
    setInput("");
    inputRef.current?.focus();
  }

  function undo(id) {
    setData((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
    setToast(null);
  }

  // ---- pending slip --------------------------------------------------------

  function createTrayForPending(name) {
    const trimmed = (name || "").trim();
    if (!pending || !trimmed) return;
    const cat = {
      id: "t" + uid(), name: trimmed,
      color: TRAY_COLORS[data.categories.length % TRAY_COLORS.length],
      words: [trimmed.toLowerCase()],
    };
    setData((d) => ({
      ...d,
      categories: [...d.categories, cat],
      items: [newItem(pending.text, cat.id, null), ...d.items],
    }));
    setPending(null);
  }

  function filePendingUnder(catId) {
    if (!pending || !catId) return;
    setData((d) => ({ ...d, items: [newItem(pending.text, catId, null), ...d.items] }));
    setPending(null);
  }

  // ---- trays ---------------------------------------------------------------

  function addTray(name) {
    const cat = {
      id: "t" + uid(), name,
      color: TRAY_COLORS[data.categories.length % TRAY_COLORS.length],
      words: [name.toLowerCase()],
    };
    setData((d) => ({ ...d, categories: [...d.categories, cat] }));
  }

  const renameTray = (id, name) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, name } : c)) }));

  function deleteTray(id) {
    if (data.categories.length <= 1) return;
    const target = data.categories.find((c) => c.id === id);
    const count = data.items.filter((it) => it.catId === id).length;
    if (count && !window.confirm(`Move ${count} item(s) out of "${target.name}" and remove the tray?`)) return;
    setData((d) => {
      const rest = d.categories.filter((c) => c.id !== id);
      return {
        ...d,
        categories: rest,
        items: d.items.map((it) => (it.catId === id ? { ...it, catId: rest[0].id, refiled: true } : it)),
      };
    });
  }

  // ---- items ----------------------------------------------------------------

  const patchItem = (id, fn) =>
    setData((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? fn(it) : it)) }));

  const refile = (id, catId) => patchItem(id, (it) => ({ ...it, catId, refiled: true }));

  const toggleDone = (id) =>
    patchItem(id, (it) => ({ ...it, done: !it.done, doneAt: !it.done ? Date.now() : null }));

  const removeItem = (id) => setData((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));

  // ---- data -----------------------------------------------------------------

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sift-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        setData(normalize(JSON.parse(r.result)));
      } catch {
        window.alert("That file does not look like a Sift export.");
      }
    };
    r.readAsText(file);
  }

  function resetAll() {
    if (window.confirm("Erase everything on this device and restore demo data?")) {
      setData(freshSeeds());
      setTrace(null);
      setPending(null);
      setToast(null);
    }
  }

  // ---- render ----------------------------------------------------------------

  const asking = trace && (trace.res.total === 0 || trace.res.confidence < POLICY.ask);

  return (
    <div className="sift">
      <header className="top">
        <div className="brand">
          <span className="wordmark">SIFT</span>
          <RegMark />
          <span className="tag">type anything — it finds its place</span>
        </div>
      </header>

      <Capture input={input} setInput={setInput} onRoute={route} inputRef={inputRef} />

      {trace && <Trace trace={trace} asking={asking} onDismiss={() => setTrace(null)} />}

      {pending && (
        <PendingSlip
          pending={pending} setPending={setPending} categories={data.categories}
          onCreate={createTrayForPending} onFileUnder={filePendingUnder} onDiscard={() => setPending(null)}
        />
      )}

      <Toolbar
        query={query} setQuery={setQuery}
        onAddTray={addTray} onExport={exportJSON} onImport={importJSON} onReset={resetAll}
      />

      <Board
        categories={data.categories} items={visibleItems} canDelete={data.categories.length > 1}
        onRenameTray={renameTray} onDeleteTray={deleteTray}
        onToggleDone={toggleDone} onRefile={refile} onRemove={removeItem}
      />

      {toast && <Toast toast={toast} onUndo={undo} />}

      <footer className="foot">
        rule-based router v1 · swap in src/lib/classifier.js · data lives on this device · refiles become training signals
      </footer>
    </div>
  );
}
```

- [ ] **Step 10: Remove the obsolete `.seg`/`.segbtn` CSS** — in `sift/src/styles.css` delete the `.seg` and `.segbtn` rule blocks (the edition toggle is gone).

- [ ] **Step 11: Build and verify**

Run: `cd sift && npm test && npm run build`
Expected: tests PASS, build completes with no errors.

Manual check (`npm run dev`, open http://localhost:5173): no Personal/Corporate toggle; route "dentist friday at 3pm" → files into Schedule with trace; "quantum sandwich logistics" → new-tray slip; undo toast works; tray rename/delete works; export then import round-trips; reset restores seeds. If an old two-workspace save existed, DevTools → Application → localStorage shows `sift.v1.backup`.

- [ ] **Step 12: Commit**

```bash
git add sift/src
git commit -m "refactor: split App into components; remove Corporate edition (personal-only)"
```

---

### Task 5: Due dates in capture, date chips, sort toggle

**Files:**
- Modify: `sift/src/App.jsx`, `sift/src/components/ItemCard.jsx`, `sift/src/components/Toolbar.jsx`, `sift/src/components/Board.jsx`, `sift/src/components/Tray.jsx`, `sift/src/styles.css`

- [ ] **Step 1: Parse dates at capture in `App.jsx`**

Add import:

```js
import { parseDue } from "./lib/dates.js";
```

Replace the `newItem` helper with:

```js
const newItem = (text, catId, conf) => {
  const parsed = parseDue(text);
  return {
    id: uid(), catId, text, conf, ts: stamp(), done: false, created: Date.now(),
    due: parsed?.due ?? null,
    hasTime: parsed?.hasTime ?? false,
    vague: parsed?.vague ?? false,
    repeat: null,
    remind: !!(parsed && parsed.due != null), // concrete date -> reminder armed by default
    doneAt: null, notifiedAt: null,
  };
};
```

- [ ] **Step 2: Add sort state in `App.jsx`**

Add next to the other `useState` calls:

```js
const [sort, setSort] = useState("new"); // "new" | "due"
```

Pass it down: `<Toolbar … sort={sort} setSort={setSort} />` and `<Board … sort={sort} />`.

- [ ] **Step 3: Sort toggle in `Toolbar.jsx`**

Add `sort, setSort` to the props destructuring, and insert directly after the `<span className="spacer" />`:

```jsx
<button
  className="ghost"
  onClick={() => setSort(sort === "new" ? "due" : "new")}
  aria-label="Toggle sort order"
>
  sort: {sort === "new" ? "newest" : "due"}
</button>
```

- [ ] **Step 4: Apply sorting in `Board.jsx`**

Add `sort` to props. Add above the component:

```js
function sortItems(list, sort) {
  if (sort !== "due") return list; // capture order is already newest-first
  return [...list].sort((a, b) => {
    const rank = (it) => (it.due != null ? 0 : it.vague ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return a.due - b.due;
    return (b.created || 0) - (a.created || 0);
  });
}
```

And change the items prop passed to each `Tray` to:

```jsx
items={sortItems(items.filter((it) => it.catId === c.id), sort)}
```

- [ ] **Step 5: Date chip in `ItemCard.jsx`**

Add import:

```js
import { dueLabel } from "../lib/dates.js";
```

Inside the component, before `return`:

```js
const label = dueLabel(item);
const overdue = !item.done && item.due != null && item.due < Date.now();
```

Insert the chip inside `<p>{item.text}</p>`'s row, after the `<p>`:

```jsx
{label && <span className={"duechip" + (overdue ? " over" : "") + (item.vague ? " vague" : "")}>{label}</span>}
```

- [ ] **Step 6: Chip styles** — append to `sift/src/styles.css`:

```css
/* ---- due-date chips ---- */

.duechip {
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.05em;
  border: 1px solid var(--ink);
  color: var(--ink);
  padding: 1px 6px;
  white-space: nowrap;
  align-self: flex-start;
  flex: none;
}

.duechip.over { border-color: var(--red); color: var(--red); }
.duechip.vague { border-style: dashed; border-color: var(--muted); color: var(--muted); }

.card-row { align-items: flex-start; }
.card-row p { flex: 1; }
```

- [ ] **Step 7: Verify**

Run: `cd sift && npm test && npm run build`
Expected: PASS, clean build.

Manual: capture "dentist friday 3pm" → card shows `FRI 3PM` chip; "someday visit japan" → dashed `SOMEDAY` chip; toggle sort → dated items first in due order.

- [ ] **Step 8: Commit**

```bash
git add sift/src
git commit -m "feat: due dates parsed at capture with chips and due-sort toggle"
```

---

### Task 6: EditSheet + repeatable tasks

**Files:**
- Create: `sift/src/components/EditSheet.jsx`
- Modify: `sift/src/App.jsx`, `sift/src/components/ItemCard.jsx`, `sift/src/styles.css`

- [ ] **Step 1: Create `sift/src/components/EditSheet.jsx`**

```jsx
import { useState } from "react";
import { parseDue } from "../lib/dates.js";

const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const toTimeInput = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const REPEAT_PRESETS = [
  { key: "none", label: "no repeat", value: null },
  { key: "day", label: "daily", value: { every: 1, unit: "day" } },
  { key: "week", label: "weekly", value: { every: 1, unit: "week" } },
  { key: "month", label: "monthly", value: { every: 1, unit: "month" } },
  { key: "year", label: "yearly", value: { every: 1, unit: "year" } },
  { key: "custom", label: "custom…", value: "custom" },
];

function presetFor(repeat) {
  if (!repeat) return "none";
  if (repeat.every === 1) return repeat.unit;
  return "custom";
}

export default function EditSheet({ item, categories, onSave, onDelete, onClose }) {
  const [text, setText] = useState(item.text);
  const [catId, setCatId] = useState(item.catId);
  const [date, setDate] = useState(item.due != null ? toDateInput(item.due) : "");
  const [time, setTime] = useState(item.due != null && item.hasTime ? toTimeInput(item.due) : "");
  const [preset, setPreset] = useState(presetFor(item.repeat));
  const [every, setEvery] = useState(item.repeat?.every ?? 1);
  const [unit, setUnit] = useState(item.repeat?.unit ?? "week");
  const [remind, setRemind] = useState(item.remind);

  function detectFromText() {
    const parsed = parseDue(text);
    if (!parsed || parsed.due == null) return;
    setDate(toDateInput(parsed.due));
    setTime(parsed.hasTime ? toTimeInput(parsed.due) : "");
  }

  function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    let due = null;
    let hasTime = false;
    if (date) {
      const [y, mo, d] = date.split("-").map(Number);
      if (time) {
        const [h, min] = time.split(":").map(Number);
        due = new Date(y, mo - 1, d, h, min).getTime();
        hasTime = true;
      } else {
        due = new Date(y, mo - 1, d, 23, 59).getTime();
      }
    }
    let repeat = null;
    if (preset === "custom") repeat = { every: Math.max(1, Number(every) || 1), unit };
    else repeat = REPEAT_PRESETS.find((p) => p.key === preset)?.value ?? null;
    onSave(item.id, {
      text: trimmed, catId, due, hasTime, vague: due == null && item.vague,
      repeat, remind: due != null && remind, notifiedAt: null,
    });
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Edit item" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">CORRECTION SLIP</div>

        <label className="field">
          <span className="label">text</span>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="label">due date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
          </label>
          <button className="ghost" onClick={() => { setDate(""); setTime(""); }}>clear</button>
          <button className="ghost" onClick={detectFromText}>detect from text</button>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="label">repeat</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value)}>
              {REPEAT_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label className="field">
                <span className="label">every</span>
                <input type="number" min="1" value={every} onChange={(e) => setEvery(e.target.value)} style={{ width: 64 }} />
              </label>
              <label className="field">
                <span className="label">unit</span>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                  <option value="year">years</option>
                </select>
              </label>
            </>
          )}
          <label className="field">
            <span className="label">tray</span>
            <select value={catId} onChange={(e) => setCatId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="remindrow">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} disabled={!date} />
          <span>remind me{date ? "" : " (set a due date first)"}</span>
        </label>

        <div className="sheet-acts">
          <button className="ghost danger" onClick={() => onDelete(item.id)}>delete</button>
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>cancel</button>
          <button className="btn" onClick={save}>save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire editing + repeat completion into `App.jsx`**

Add imports:

```js
import { nextOccurrence, dueLabel } from "./lib/dates.js";
import EditSheet from "./components/EditSheet.jsx";
```

Add state: `const [editing, setEditing] = useState(null); // item id or null`

Replace `toggleDone` with the repeat-aware version:

```js
function toggleDone(id) {
  const it = data.items.find((x) => x.id === id);
  if (!it) return;
  if (!it.done && it.repeat) {
    const due = nextOccurrence(it.due, it.repeat);
    patchItem(id, (x) => ({ ...x, done: false, doneAt: Date.now(), due, notifiedAt: null }));
    pushToast({ text: `done — next: ${dueLabel({ due, hasTime: it.hasTime })}` });
    return;
  }
  patchItem(id, (x) => ({ ...x, done: !x.done, doneAt: !x.done ? Date.now() : null }));
}
```

Add the save/delete handlers:

```js
function saveEdit(id, patch) {
  patchItem(id, (it) => ({ ...it, ...patch }));
  setEditing(null);
}

function deleteFromSheet(id) {
  removeItem(id);
  setEditing(null);
}
```

Pass `onEdit={setEditing}` down: `<Board … onEdit={setEditing} />`. Render the sheet before the closing `</div>` of `.sift`:

```jsx
{editing && (
  <EditSheet
    item={data.items.find((it) => it.id === editing)}
    categories={data.categories}
    onSave={saveEdit}
    onDelete={deleteFromSheet}
    onClose={() => setEditing(null)}
  />
)}
```

In `Board.jsx` and `Tray.jsx`, accept `onEdit` in props and pass it through to `ItemCard`.

- [ ] **Step 3: Open the sheet from `ItemCard.jsx` + repeat glyph**

Add `onEdit` to props and `repeatLabel` to the dates import:

```js
import { dueLabel, repeatLabel } from "../lib/dates.js";
```

Replace `<p>{item.text}</p>` with a button (keyboard-accessible edit affordance):

```jsx
<button className="cardtext" onClick={() => onEdit(item.id)} title="Edit">{item.text}</button>
```

Next to the due chip, add the repeat glyph:

```jsx
{item.repeat && <span className="repglyph">{repeatLabel(item.repeat)}</span>}
```

- [ ] **Step 4: Sheet + card-text styles** — append to `sift/src/styles.css`:

```css
/* ---- edit sheet (correction slip) ---- */

.cardtext {
  font-family: var(--sans);
  font-size: 14.5px;
  line-height: 1.45;
  background: none;
  border: 0;
  padding: 0;
  margin: 0 0 8px;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  flex: 1;
}

.card.done .cardtext { text-decoration: line-through; }

.repglyph {
  font-family: var(--mono);
  font-size: 9.5px;
  color: var(--muted);
  border: 1px dashed var(--line);
  padding: 1px 5px;
  white-space: nowrap;
  flex: none;
}

.scrim {
  position: fixed;
  inset: 0;
  background: rgba(20, 20, 20, 0.45);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet {
  background: var(--card);
  border: 1.5px dashed var(--ink);
  box-shadow: 5px 5px 0 var(--shadow);
  padding: 16px;
  width: min(520px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sheet-head {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--muted);
}

.field { display: flex; flex-direction: column; gap: 4px; }
.field-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }

.label {
  font-family: var(--mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.sheet textarea,
.sheet input,
.sheet select {
  font-family: var(--sans);
  font-size: 14px;
  padding: 7px 9px;
  border: 1.5px solid var(--ink);
  border-radius: 0;
  background: var(--card);
  color: var(--ink);
}

.remindrow { display: flex; gap: 8px; align-items: center; font-size: 13.5px; }

.sheet-acts { display: flex; gap: 8px; align-items: center; }
.sheet-acts .spacer { flex: 1; }

@media (max-width: 640px) {
  .scrim { align-items: flex-end; }
  .sheet {
    width: 100vw;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    box-shadow: none;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    animation: sheetup 0.22s ease;
  }
}

@keyframes sheetup {
  from { transform: translateY(40px); opacity: 0.4; }
  to { transform: translateY(0); opacity: 1; }
}
```

- [ ] **Step 5: Verify**

Run: `cd sift && npm test && npm run build`
Expected: PASS, clean build.

Manual: tap card text → sheet opens; change text/date/tray → saves; set repeat weekly, mark done → card stays undone with due advanced one week and toast "done — next: …"; delete from sheet removes the card; Escape-equivalent (scrim tap) closes without saving.

- [ ] **Step 6: Commit**

```bash
git add sift/src
git commit -m "feat: edit sheet with due, tray, reminder toggle, and repeat cycles"
```

---

### Task 7: Reminders — `lib/notify.js` + wiring

**Files:**
- Create: `sift/src/lib/notify.js`
- Modify: `sift/package.json`, `sift/src/App.jsx`

- [ ] **Step 1: Install the Capacitor plugin (must match Capacitor 6)**

Run: `cd sift && npm i @capacitor/local-notifications@^6`
Expected: installs cleanly alongside `@capacitor/core@^6`.

- [ ] **Step 2: Create `sift/src/lib/notify.js`**

```js
// Reminder scheduling. Native Android (Capacitor) gets real OS-scheduled
// notifications that fire with the app closed. Web gets best-effort
// notifications while Sift is open — the web platform cannot fire scheduled
// notifications from a fully closed page without a push server.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNative = Capacitor.isNativePlatform();

// When this item's reminder should fire (epoch ms), or null if no reminder
// applies. May be in the past — callers decide what past means.
export function reminderTime(item) {
  if (!item.remind || item.done || item.vague || item.due == null) return null;
  if (item.hasTime) return item.due;
  const d = new Date(item.due);
  d.setHours(9, 0, 0, 0); // date-only items remind at 09:00 that day
  return d.getTime();
}

// Stable positive int32 id for Capacitor from the string item id.
function numericId(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2147483646 + 1;
}

export async function ensurePermission() {
  try {
    if (isNative) {
      const r = await LocalNotifications.requestPermissions();
      return r.display === "granted";
    }
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

// Native only: cancel everything pending and reschedule all future reminders.
// Called whenever items change — idempotent by construction.
export async function syncReminders(items) {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const now = Date.now();
    const notifications = items
      .map((it) => ({ it, at: reminderTime(it) }))
      .filter((x) => x.at != null && x.at > now)
      .map(({ it, at }) => ({
        id: numericId(it.id),
        title: "Sift",
        body: it.text,
        schedule: { at: new Date(at) },
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch { /* notifications unavailable — app works without them */ }
}
```

- [ ] **Step 3: Wire into `App.jsx`**

Add imports:

```js
import { ensurePermission, syncReminders, reminderTime, isNative } from "./lib/notify.js";
```

Add these effects after the existing `useEffect(() => save(data), [data]);`:

```js
// keep native scheduled notifications in sync with items
useEffect(() => { syncReminders(data.items); }, [data.items]);

// web fallback: check every minute while the app is open
const itemsRef = useRef(data.items);
useEffect(() => { itemsRef.current = data.items; }, [data.items]);
useEffect(() => {
  if (isNative || !("Notification" in window)) return;
  const tick = () => {
    if (Notification.permission !== "granted") return;
    const now = Date.now();
    const fire = itemsRef.current.filter((it) => {
      const t = reminderTime(it);
      return t != null && t <= now && !it.notifiedAt;
    });
    if (!fire.length) return;
    fire.forEach((it) => new Notification("Sift", { body: it.text, tag: it.id }));
    setData((d) => ({
      ...d,
      items: d.items.map((it) => (fire.some((f) => f.id === it.id) ? { ...it, notifiedAt: now } : it)),
    }));
  };
  tick();
  const t = setInterval(tick, 60_000);
  return () => clearInterval(t);
}, []);
```

In `route()`, after the auto-file and ask-band branches (both file an item), arm permission lazily — add as the last statement before `setInput("")`:

```js
if (parseDueArmed(text)) ensurePermission();
```

…where `parseDueArmed` is this tiny helper next to `newItem` (avoids re-deriving inside JSX):

```js
const parseDueArmed = (text) => { const p = parseDue(text); return !!(p && p.due != null); };
```

In `saveEdit`, request permission when a reminder is armed:

```js
function saveEdit(id, patch) {
  patchItem(id, (it) => ({ ...it, ...patch }));
  if (patch.remind && patch.due != null) ensurePermission();
  setEditing(null);
}
```

- [ ] **Step 4: Verify**

Run: `cd sift && npm test && npm run build`
Expected: PASS, clean build (the Capacitor plugin bundles fine for web; all calls are guarded).

Manual (web): capture "test reminder at <2 minutes from now>" → browser asks notification permission; with the tab open, a notification fires within a minute of the due time and does not repeat. Native path is verified at Android build time (`npx cap sync android`), out of band.

- [ ] **Step 5: Commit**

```bash
git add sift/package.json sift/package-lock.json sift/src
git commit -m "feat: reminders — native scheduled notifications + web best-effort"
```

---

### Task 8: Drag-and-drop refiling

**Files:**
- Modify: `sift/package.json`, `sift/src/components/Board.jsx`, `sift/src/components/Tray.jsx`, `sift/src/components/ItemCard.jsx`, `sift/src/styles.css`

- [ ] **Step 1: Install dnd-kit**

Run: `cd sift && npm i @dnd-kit/core`

- [ ] **Step 2: DnD context in `Board.jsx`** — full replacement file:

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

export default function Board({ categories, items, sort, canDelete, onRenameTray, onDeleteTray, onToggleDone, onRefile, onRemove, onEdit }) {
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
            canDelete={canDelete}
            onRename={onRenameTray}
            onDelete={onDeleteTray}
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

- [ ] **Step 3: Make `Tray.jsx` droppable**

Add import: `import { useDroppable } from "@dnd-kit/core";`

Inside the component, first lines:

```js
const { isOver, setNodeRef } = useDroppable({ id: "tray:" + cat.id });
```

Change the section opening tag to:

```jsx
<section ref={setNodeRef} className={"tray" + (isOver ? " over" : "")} style={{ "--c": cat.color }}>
```

- [ ] **Step 4: Make `ItemCard.jsx` draggable**

Add import: `import { useDraggable } from "@dnd-kit/core";`

Inside the component, first lines:

```js
const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
```

Change the article opening tag to:

```jsx
<article
  ref={setNodeRef}
  {...attributes}
  {...listeners}
  className={"card" + (item.done ? " done" : "") + (isDragging ? " dragging" : "")}
  style={{ "--tilt": tilt(item.id) }}
>
```

- [ ] **Step 5: Drag styles** — append to `sift/src/styles.css`:

```css
/* ---- drag and drop ---- */

.card { touch-action: manipulation; }
.card.dragging { opacity: 0.35; }

.dragproof .card {
  box-shadow: 7px 7px 0 var(--shadow);
  transform: rotate(-1.2deg);
  animation: none;
  cursor: grabbing;
}

.tray.over { outline: 2.5px solid var(--c); outline-offset: 2px; }
```

- [ ] **Step 6: Verify**

Run: `cd sift && npm test && npm run build`
Expected: PASS, clean build.

Manual: drag a card to another tray on desktop (cursor drag) → it refiles, card meta shows "refiled", clicks on check/select/text still work without starting a drag. In responsive mode (DevTools mobile emulation), long-press lifts a card, short tap opens the edit sheet, scrolling still works.

- [ ] **Step 7: Commit**

```bash
git add sift/package.json sift/package-lock.json sift/src
git commit -m "feat: drag-and-drop refiling with touch long-press via dnd-kit"
```

---

### Task 9: Dark mode — night print shop

**Files:**
- Modify: `sift/src/App.jsx`, `sift/src/components/Tray.jsx`, `sift/src/components/Trace.jsx`, `sift/src/components/Board.jsx`, `sift/index.html`, `sift/src/styles.css`

- [ ] **Step 1: Theme state in `App.jsx`**

Add `inkFor` to the store import. Add state + effects:

```js
const [sysDark, setSysDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
useEffect(() => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const fn = (e) => setSysDark(e.matches);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}, []);

const theme = data.theme === "auto" ? (sysDark ? "dark" : "light") : data.theme;

useEffect(() => {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#17171b" : "#141414");
}, [theme]);

const cycleTheme = () =>
  setData((d) => ({ ...d, theme: d.theme === "auto" ? "light" : d.theme === "light" ? "dark" : "auto" }));
```

Add the cycle button in the header, after `</div>` of `.brand`:

```jsx
<button className="ghost themebtn" onClick={cycleTheme} aria-label="Cycle theme">
  {data.theme === "auto" ? "◐ auto" : data.theme === "light" ? "○ light" : "● dark"}
</button>
```

Apply night inks where colors render — pass `theme` to `Board` (`<Board … theme={theme} />`) and to `Trace` (`<Trace … theme={theme} />`).

- [ ] **Step 2: Use `inkFor` in `Board.jsx`, `Tray.jsx`, `Trace.jsx`**

`Board.jsx`: accept `theme` prop, pass `theme={theme}` to each `Tray`.

`Tray.jsx`: add `import { inkFor } from "../lib/store.js";`, accept `theme`, and change the section style to:

```jsx
style={{ "--c": inkFor(cat.color, theme) }}
```

`Trace.jsx`: add the same import, accept `theme`, and change the bar background to:

```jsx
<span style={{ width: (r.score / maxScore) * 100 + "%", background: inkFor(r.cat.color, theme) }} />
```

- [ ] **Step 3: Pre-paint theme script** — in `sift/index.html`, add as the FIRST element inside `<head>` after `<meta charset>`:

```html
<script>
  try {
    var t = (JSON.parse(localStorage.getItem("sift.v1") || "{}").theme) || "auto";
    if (t === "auto") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = t;
  } catch (e) { /* defaults apply */ }
</script>
```

- [ ] **Step 4: Dark tokens** — append to `sift/src/styles.css`:

```css
/* ---- night print shop ---- */

:root[data-theme="dark"] {
  --paper: #17171b;
  --card: #212126;
  --ink: #f0ede6;
  --muted: #8e8a82;
  --line: #3a3a40;
  --red: #ff48b0;
  --shadow: rgba(0, 0, 0, 0.9);
}

:root[data-theme="dark"] body::before { opacity: 0.4; }

.themebtn { white-space: nowrap; }
```

- [ ] **Step 5: Verify**

Run: `cd sift && npm test && npm run build`
Expected: PASS, clean build.

Manual: cycle ◐ auto → ○ light → ● dark; in dark, paper goes ink-black, tray colors switch to fluorescent inks, no flash of light theme on reload while dark is active; auto follows the OS setting.

- [ ] **Step 6: Commit**

```bash
git add sift/index.html sift/src
git commit -m "feat: night-print dark mode with fluorescent inks and pre-paint script"
```

---

### Task 10: Mobile swipe pager with droppable tray tabs

**Files:**
- Modify: `sift/src/components/Board.jsx`, `sift/src/styles.css`

- [ ] **Step 1: Tabs + snap container in `Board.jsx`**

Add imports: `useEffect, useRef` from react; `useDroppable` from `@dnd-kit/core`; `inkFor` from `../lib/store.js`.

Add the tab component above `Board`:

```jsx
function TrayTab({ cat, count, active, theme, onSelect }) {
  const { isOver, setNodeRef } = useDroppable({ id: "tab:" + cat.id });
  return (
    <button
      ref={setNodeRef}
      className={"traytab" + (active ? " on" : "") + (isOver ? " over" : "")}
      style={{ "--c": inkFor(cat.color, theme) }}
      onClick={onSelect}
    >
      <span className="drum" aria-hidden="true" />
      {cat.name} <span className="tabcount">{count}</span>
    </button>
  );
}
```

Inside `Board`, add active-tray tracking and scroll sync:

```js
const [activeTray, setActiveTray] = useState(categories[0]?.id);
const boardRef = useRef(null);
const trayRefs = useRef({});

useEffect(() => {
  const root = boardRef.current;
  if (!root) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) if (en.isIntersecting) setActiveTray(en.target.dataset.trayid);
    },
    { root, threshold: 0.6 },
  );
  Object.values(trayRefs.current).forEach((el) => el && io.observe(el));
  return () => io.disconnect();
}, [categories]);

const scrollToTray = (id) =>
  trayRefs.current[id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
```

Render the tab bar inside the `DndContext`, before `.board`:

```jsx
<div className="traytabs" role="tablist" aria-label="Trays">
  {categories.map((c) => (
    <TrayTab
      key={c.id}
      cat={c}
      count={items.filter((it) => it.catId === c.id).length}
      active={activeTray === c.id}
      theme={theme}
      onSelect={() => scrollToTray(c.id)}
    />
  ))}
</div>
```

Wrap each `Tray` for observation — change the board children to:

```jsx
{categories.map((c) => (
  <div key={c.id} className="traywrap" data-trayid={c.id} ref={(el) => { trayRefs.current[c.id] = el; }}>
    <Tray
      cat={c}
      items={sortItems(items.filter((it) => it.catId === c.id), sort)}
      categories={categories}
      theme={theme}
      canDelete={canDelete}
      onRename={onRenameTray}
      onDelete={onDeleteTray}
      onToggleDone={onToggleDone}
      onRefile={onRefile}
      onRemove={onRemove}
      onEdit={onEdit}
    />
  </div>
))}
```

And add `ref={boardRef}` to the `.board` div.

- [ ] **Step 2: Pager styles** — append to `sift/src/styles.css`:

```css
/* ---- mobile swipe pager ---- */

.traytabs { display: none; }

@media (max-width: 640px) {
  .traytabs {
    position: sticky;
    top: 0;
    z-index: 6;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 8px 0;
    background: var(--paper);
    scrollbar-width: none;
  }
  .traytabs::-webkit-scrollbar { display: none; }

  .traytab {
    font-family: var(--mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    color: var(--ink);
    padding: 7px 11px;
    white-space: nowrap;
    cursor: pointer;
  }
  .traytab.on { background: var(--ink); color: var(--card); }
  .traytab.over { outline: 2.5px solid var(--c); outline-offset: 2px; }
  .traytab .drum { width: 9px; height: 9px; }
  .tabcount { opacity: 0.65; }

  .board {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 12px;
    scrollbar-width: none;
  }
  .board::-webkit-scrollbar { display: none; }

  .traywrap {
    flex: 0 0 100%;
    scroll-snap-align: center;
    min-width: 0;
  }
}
```

Then DELETE the old `.board { grid-template-columns: 1fr; }` line from the existing `@media (max-width: 640px)` block — the pager replaces stacking.

- [ ] **Step 3: Verify**

Run: `cd sift && npm test && npm run build`
Expected: PASS, clean build.

Manual (DevTools mobile emulation): tab bar appears; swiping the board snaps tray to tray; the active tab inverts and follows the swipe; tapping a tab scrolls to its tray; long-press-dragging a card onto another tab refiles it. Desktop unchanged (grid, no tabs).

- [ ] **Step 4: Commit**

```bash
git add sift/src
git commit -m "feat: mobile swipe pager with droppable tray tabs"
```

---

### Task 11: Stats strip

**Files:**
- Create: `sift/src/components/StatsStrip.jsx`
- Modify: `sift/src/App.jsx`, `sift/src/styles.css`

- [ ] **Step 1: Create `sift/src/components/StatsStrip.jsx`**

```jsx
const DAY = 86_400_000;
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

export default function StatsStrip({ items }) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const today = t0.getTime();

  const captured = items.filter((it) => it.created && it.created >= today).length;
  const done = items.filter((it) => it.doneAt && it.doneAt >= today).length;

  const doneDays = new Set(items.filter((it) => it.doneAt).map((it) => dayKey(it.doneAt)));
  let streak = 0;
  for (let t = today; doneDays.has(dayKey(t)); t -= DAY) streak += 1;

  return (
    <div className="stats" aria-label="Today's stats">
      today: {captured} captured · {done} done · streak {streak} day{streak === 1 ? "" : "s"}
    </div>
  );
}
```

- [ ] **Step 2: Mount in `App.jsx`** — import it and render between `<Board …/>` and the toast:

```jsx
<StatsStrip items={data.items} />
```

- [ ] **Step 3: Styles** — append to `sift/src/styles.css`:

```css
/* ---- stats strip ---- */

.stats {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  margin-top: 22px;
  border-top: 1px dashed var(--line);
  padding-top: 12px;
}

@media (max-width: 640px) {
  .stats { margin-bottom: 8px; }
}
```

- [ ] **Step 4: Verify**

Run: `cd sift && npm test && npm run build` — PASS. Manual: capture an item → "1 captured"; mark done → "1 done · streak 1 day".

- [ ] **Step 5: Commit**

```bash
git add sift/src
git commit -m "feat: stats strip — captured, done, streak"
```

---

### Task 12: Polish, infra, ship

**Files:**
- Modify: `sift/src/styles.css`, `sift/src/components/Tray.jsx`, `sift/public/sw.js`, `sift/README.md`

- [ ] **Step 1: Empty state with registration mark** — in `Tray.jsx`, replace the `.empty` div with:

```jsx
{items.length === 0 && (
  <div className="empty">
    <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
      <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 0v20 M0 10h20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
    <span>empty — type above</span>
  </div>
)}
```

- [ ] **Step 2: Polish CSS** — append to `sift/src/styles.css`:

```css
/* ---- polish pass ---- */

.empty {
  display: flex;
  align-items: center;
  gap: 7px;
  opacity: 0.8;
}

/* comfortable touch targets on coarse pointers */
@media (pointer: coarse) {
  .check { font-size: 19px; padding: 4px 6px; margin: -4px 0 0 -6px; }
  .x { font-size: 20px; padding: 6px 8px; }
  .ghost { padding: 9px 13px; }
  .acts select { padding: 6px 8px; font-size: 12px; }
}

/* toast slides up */
.toast { animation: toastup 0.2s ease; }
@keyframes toastup {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .toast, .sheet { animation: none; }
}
```

- [ ] **Step 3: Bump the service worker cache** — in `sift/public/sw.js` line 1:

```js
const CACHE = "sift-v2";
```

- [ ] **Step 4: Rewrite `sift/README.md`**

```markdown
# Sift

Type anything — it finds its place. A phone-first **personal** capture-and-route
organizer: free-form input is classified into trays (Tasks, Ideas, Plans,
Schedule), due dates are parsed from plain text, items can repeat on any cycle,
and reminders fire on your phone. Data persists on-device. (The Corporate
edition split off into a separate future app; old two-workspace saves are
migrated automatically and backed up to `sift.v1.backup`.)

Design language: Risograph print shop (real riso spot-ink hexes, paper grain,
off-register marks) × Teenage Engineering hardware (mono labels, hard shadows,
buttons that physically press). Dark mode is a midnight press room with
fluorescent riso inks.

## Requirements
Node 18+. For native Android builds: Android Studio with SDK.

## Run on PC
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: dates, classifier, store migration
```
Production: `npm run build && npm run preview`. In Chrome/Edge, the install
icon in the address bar installs it as a desktop app (PWA).

## Run on Android
**Path A — PWA (fastest).** Deploy `dist/` anywhere with https
(e.g. `vercel deploy dist`), open in Chrome → *Add to Home screen*.

**Path B — native APK (Capacitor).**
```bash
npm run build
npx cap add android      # one-time
npx cap sync android
npx cap open android     # Android Studio → Build → APK
```

## Features
- **Capture & route** — confidence policy: ≥75% silent, 35–74% undo toast,
  <35% proposes a new tray.
- **Due dates from text** — "dentist friday 3pm", "jun 15", "tonight";
  vague phrases ("someday", "in the future") become a SOMEDAY chip.
- **Edit anything** — tap a card: text, due, repeat, tray, reminder, delete.
- **Repeats** — daily/weekly/monthly/yearly or every N units; completing
  reschedules and credits your streak.
- **Reminders** — native Android APK: real OS notifications, app closed or not
  (date-only items at 09:00). Web/PWA: notifications fire while Sift is open —
  the web platform cannot schedule closed-page notifications without a push
  server, so install the APK for full reminders.
- **Drag-and-drop refiling** — long-press on touch; drop on a tray or its tab.
- **Dark mode** — auto/light/dark toggle in the header.
- **Mobile pager** — swipe between trays, tabs show counts.

## Swap in the real AI
`src/lib/classifier.js` is still the single swap point. Replace `classify()`
with an async Claude API call returning the same shape; keep the rule engine
as the offline fallback.

## Project map
```
src/App.jsx            state owner + composition
src/components/        Capture, Trace, PendingSlip, Toolbar, Board, Tray,
                       ItemCard, EditSheet, StatsStrip, Toast
src/lib/classifier.js  routing engine + thresholds (the AI swap point)
src/lib/dates.js       due-date parser + repeat arithmetic
src/lib/notify.js      reminders (Capacitor native / web fallback)
src/lib/store.js       persistence, migration, riso + night ink palettes
src/styles.css         the print-shop design system
```
```

- [ ] **Step 5: Full verification**

Run: `cd sift && npm test && npm run build`
Expected: all tests PASS, build clean.

Manual full pass (`npm run dev`, desktop + DevTools mobile emulation): capture each example chip; check trace, undo, new-tray slip; edit an item (text, due, repeat weekly, tray); complete the repeating item; drag-refile on desktop and onto a mobile tab; cycle theme; swipe pager; stats strip counts; export/import; reset.

- [ ] **Step 6: Commit and push**

```bash
git add sift docs
git commit -m "feat: polish pass, sw cache bump, README for personal edition"
git push origin dev
```

- [ ] **Step 7: Open PR** — create a pull request `dev → main` on `Kushahn/Sift` titled `feat: Sift personal edition — dates, editing, repeats, reminders, DnD, dark mode, pager` (use the GitHub MCP `create_pull_request` tool or the REST API with `$env:GITHUB_TOKEN`; `gh` CLI is not installed). Do not merge without the user.

---

## Verification checklist (whole plan)

- [ ] `npm test` green: dates (incl. month-end clamp, catch-up), classifier guards, store migration + backup + inkFor
- [ ] `npm run build` clean
- [ ] No Corporate UI anywhere; old saves migrate with `sift.v1.backup` written
- [ ] Phone-first interactions all work in mobile emulation: pager, long-press drag, bottom sheet, fixed capture bar
- [ ] Riso identity intact in both themes (no rounded corners, no gradients, hard shadows)
- [ ] PR open from `dev` to `main`; `main` untouched locally


