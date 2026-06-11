// Persistence + seeds. Data lives on-device (localStorage).
// Riso spot-ink palette — hex values per print-studio ink charts.

const KEY = "sift.v1";

export const RISO = {
  blue: "#0078BF",
  red: "#F15060",
  green: "#00A95C",
  sunflower: "#FFB511",
  violet: "#9D7AD2",
  orange: "#FF6C2F",
  teal: "#00838A",
  federal: "#3D5588",
};

export const TRAY_COLORS = Object.values(RISO);

export function freshSeeds() {
  return {
    active: "personal",
    workspaces: {
      personal: {
        categories: [
          { id: "tasks", name: "Tasks", lexicon: "tasks", color: RISO.green },
          { id: "ideas", name: "Ideas", lexicon: "ideas", color: RISO.violet },
          { id: "plans", name: "Plans", lexicon: "plans", color: RISO.blue },
          { id: "events", name: "Schedule", lexicon: "events", color: RISO.sunflower },
        ],
        items: [
          { id: "s1", catId: "tasks", text: "Submit the lab report before Friday", conf: 64, ts: "earlier", done: false },
          { id: "s2", catId: "ideas", text: "What if flashcards generated themselves from lecture notes", conf: 71, ts: "earlier", done: false },
          { id: "s3", catId: "events", text: "Dentist appointment Tuesday at 4pm", conf: 88, ts: "earlier", done: false },
        ],
      },
      corporate: {
        categories: [
          { id: "brainstorm", name: "Brainstorm", lexicon: "brainstorm", color: RISO.red },
          { id: "actions", name: "Action items", lexicon: "tasks", color: RISO.green },
          { id: "projects", name: "Projects", lexicon: "plans", color: RISO.federal },
          { id: "schedule", name: "Scheduling", lexicon: "events", color: RISO.sunflower },
        ],
        items: [
          { id: "s4", catId: "brainstorm", text: "Thoughts on renaming the onboarding flow?", conf: 77, ts: "earlier", done: false },
          { id: "s5", catId: "schedule", text: "All-hands moved to Thursday 11am", conf: 90, ts: "earlier", done: false },
        ],
      },
    },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.workspaces && data.active) return data;
    }
  } catch {
    /* corrupted storage — fall through to seeds */
  }
  return freshSeeds();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — app keeps working in memory */
  }
}
