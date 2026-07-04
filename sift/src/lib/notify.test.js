import { describe, it, expect } from "vitest";
import { reminderTime } from "./notify.js";

const at = (y, mo, d, h = 0, min = 0) => new Date(y, mo, d, h, min).getTime();

describe("reminderTime", () => {
  const base = { remind: true, done: false, vague: false, due: at(2026, 5, 11, 15, 0), hasTime: true, remindOffset: 0 };

  it("fires at the due time by default", () => {
    expect(reminderTime(base)).toBe(at(2026, 5, 11, 15, 0));
  });
  it("subtracts the lead-time offset in minutes", () => {
    expect(reminderTime({ ...base, remindOffset: 30 })).toBe(at(2026, 5, 11, 14, 30));
    expect(reminderTime({ ...base, remindOffset: 1440 })).toBe(at(2026, 5, 10, 15, 0));
  });
  it("date-only items remind at 09:00 minus the offset", () => {
    const dateOnly = { ...base, hasTime: false, due: at(2026, 5, 11, 23, 59), remindOffset: 15 };
    expect(reminderTime(dateOnly)).toBe(at(2026, 5, 11, 8, 45));
  });
  it("returns null when off, done, vague, or dateless", () => {
    expect(reminderTime({ ...base, remind: false })).toBeNull();
    expect(reminderTime({ ...base, done: true })).toBeNull();
    expect(reminderTime({ ...base, vague: true })).toBeNull();
    expect(reminderTime({ ...base, due: null })).toBeNull();
  });
});
