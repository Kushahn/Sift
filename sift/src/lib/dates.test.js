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
