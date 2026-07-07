// Persistence + seeds + ink palettes. Personal-only flat model.
// Old two-workspace saves are lifted to the flat shape; the original blob is
// backed up to sift.v1.backup first so corporate data survives for the
// future corporate app.

import { mirrorToExt } from "./ext.js";

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
  repeat: null, remind: false, remindOffset: 0, created: null, doneAt: null, notifiedAt: null,
};

const CAT_DEFAULTS = { collapsed: false };

const HEX_RX = /^#[0-9a-f]{3,8}$/i; // colors land in inline styles — hex only

export function normalize(data) {
  if (!data) throw new Error("bad shape");
  const src = data.workspaces ? data.workspaces.personal : data;
  if (!src || !Array.isArray(src.categories) || !Array.isArray(src.items)) throw new Error("bad shape");
  const categories = src.categories.map((c, i) => ({
    ...CAT_DEFAULTS,
    ...c,
    name: typeof c.name === "string" && c.name.trim() ? c.name : "Tray",
    color: HEX_RX.test(c.color) ? c.color : TRAY_COLORS[i % TRAY_COLORS.length],
  }));
  const ids = new Set(categories.map((c) => c.id));
  return {
    categories,
    items: src.items
      .filter((it) => it && typeof it.text === "string")
      .map((it, i) => ({
        ...ITEM_DEFAULTS,
        ...it,
        id: String(it.id ?? "imp" + i),
        catId: ids.has(it.catId) ? it.catId : categories[0]?.id, // orphaned import -> first tray
      }))
      .filter((it) => it.catId != null), // zero trays -> zero items
    theme: data.theme === "light" || data.theme === "dark" ? data.theme : "auto",
    showExamples: data.showExamples === true, // only a genuine fresh install (freshSeeds) sets this
  };
}

// A clean slate: a few typical empty trays, no sample items. The example chips
// under the capture bar (Capture.jsx, gated on showExamples) are the try-it-out
// affordance instead, and they disappear after the first capture.
export function freshSeeds() {
  return {
    theme: "auto",
    showExamples: true,
    categories: [
      { id: "todo", name: "To-do List", lexicon: "tasks", color: RISO.green },
      { id: "plans", name: "Plans", lexicon: "plans", color: RISO.blue },
      { id: "job", name: "Job", lexicon: "events", color: RISO.sunflower },
    ],
    items: [],
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
  const json = JSON.stringify(state);
  try { localStorage.setItem(KEY, json); }
  catch { /* storage full or unavailable — app keeps working in memory */ }
  mirrorToExt(json); // durable copy for the extension (survives updates)
}
