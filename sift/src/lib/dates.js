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
