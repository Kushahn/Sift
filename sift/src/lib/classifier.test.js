import { describe, it, expect } from "vitest";
import { classify, suggestName, learn, salientWords, POLICY } from "./classifier.js";

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

describe("salientWords", () => {
  it("keeps distinctive tokens and drops stopwords and short words", () => {
    expect(salientWords("Submit the lab report before Friday"))
      .toEqual(["submit", "report", "before", "friday"]);
  });
  it("dedupes repeated tokens regardless of case", () => {
    expect(salientWords("garden garden GARDEN bed")).toEqual(["garden"]);
  });
});

describe("learn", () => {
  it("adds a correction's salient words to the tray's words[] without losing existing ones", () => {
    const cat = { id: "g", name: "Garden", words: ["garden"] };
    const next = learn(cat, "repot the tomato seedlings");
    expect(next.words).toContain("garden");
    expect(next.words).toContain("tomato");
    expect(next.words).toContain("seedlings");
  });
  it("does not mutate the input category", () => {
    const cat = { id: "g", name: "Garden", words: ["garden"] };
    const snapshot = [...cat.words];
    learn(cat, "tomato seedlings sprouting");
    expect(cat.words).toEqual(snapshot);
  });
  it("never writes into a seed tray's shared lexicon", () => {
    const seed = { id: "tasks", name: "Tasks", lexicon: "tasks" };
    const taught = learn(seed, "tomato seedlings");
    expect(taught.words).toContain("tomato");
    // a *different* tray on the same lexicon must not have gained the word
    const other = { id: "other", name: "Other", lexicon: "tasks" };
    expect(classify("tomato", [other]).confidence).toBe(0);
  });
  it("does not relearn words already covered by the tray's lexicon", () => {
    const seed = { id: "tasks", name: "Tasks", lexicon: "tasks", words: [] };
    const next = learn(seed, "submit the report");
    expect(next.words).not.toContain("submit"); // already a tasks lexicon word
    expect(next.words).toContain("report");
  });
  it("caps how many words a single correction can add (anti-overfit)", () => {
    const cat = { id: "g", name: "Garden", words: [] };
    const next = learn(cat, "alpha bravo charlie delta echo foxtrot golf hotel");
    expect(next.words.length).toBeLessThanOrEqual(4);
  });
});

describe("classify learns from refiles", () => {
  it("routes new similar text toward a tray that learned the words", () => {
    const cats = [
      { id: "tasks", name: "Tasks", lexicon: "tasks" },
      { id: "garden", name: "Garden", words: ["garden"] },
    ];
    expect(classify("tomato seedlings need water", cats).best.cat.id).not.toBe("garden");
    const taught = cats.map((c) => (c.id === "garden" ? learn(c, "tomato seedlings") : c));
    expect(classify("the tomato seedlings sprouted", taught).best.cat.id).toBe("garden");
  });
  it("merges learned words with a seed tray's shared lexicon", () => {
    const cats = [{ id: "tasks", name: "Tasks", lexicon: "tasks", words: ["dentist"] }];
    expect(classify("dentist", cats).best.cat.id).toBe("tasks");   // learned word
    expect(classify("buy milk", cats).best.cat.id).toBe("tasks");  // original lexicon still works
  });
});
