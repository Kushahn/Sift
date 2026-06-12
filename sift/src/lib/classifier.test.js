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
