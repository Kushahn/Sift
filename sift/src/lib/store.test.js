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
  it("defaults collapsed to false on categories", () => {
    expect(normalize(freshSeeds()).categories[0].collapsed).toBe(false);
  });
  it("keeps an explicit collapsed flag", () => {
    const src = { ...freshSeeds(), categories: freshSeeds().categories.map((c) => ({ ...c, collapsed: true })) };
    expect(normalize(src).categories.every((c) => c.collapsed === true)).toBe(true);
  });
  it("reassigns items whose tray no longer exists to the first tray", () => {
    const s = normalize({ categories: [{ id: "a", name: "A", color: "#123456" }], items: [{ id: "x", catId: "ghost", text: "hi" }] });
    expect(s.items[0].catId).toBe("a");
  });
  it("rejects imports with no trays", () => {
    expect(() => normalize({ categories: [], items: [] })).toThrow();
  });
  it("replaces junk category colors and names with safe defaults", () => {
    const s = normalize({ categories: [{ id: "a", name: "", color: "url(evil)" }], items: [] });
    expect(s.categories[0].color).toMatch(/^#[0-9a-f]{3,8}$/i);
    expect(s.categories[0].name).toBe("Tray");
  });
  it("drops items without text", () => {
    const s = normalize({ categories: [{ id: "a", name: "A", color: "#123456" }], items: [{ id: "x", catId: "a" }, null] });
    expect(s.items).toHaveLength(0);
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
