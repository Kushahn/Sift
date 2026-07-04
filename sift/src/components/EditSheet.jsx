import { useState } from "react";
import { parseDue } from "../lib/dates.js";

const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const toTimeInput = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const REPEAT_PRESETS = [
  { key: "none", label: "no repeat", value: null },
  { key: "hour", label: "hourly", value: { every: 1, unit: "hour" } },
  { key: "day", label: "daily", value: { every: 1, unit: "day" } },
  { key: "week", label: "weekly", value: { every: 1, unit: "week" } },
  { key: "month", label: "monthly", value: { every: 1, unit: "month" } },
  { key: "year", label: "yearly", value: { every: 1, unit: "year" } },
  { key: "custom", label: "custom…", value: "custom" },
];

const OFFSET_PRESETS = [
  { v: 0, label: "at the time" },
  { v: 5, label: "5 min before" },
  { v: 15, label: "15 min before" },
  { v: 30, label: "30 min before" },
  { v: 60, label: "1 hour before" },
  { v: 1440, label: "1 day before" },
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
  const [offset, setOffset] = useState(
    OFFSET_PRESETS.some((o) => o.v === (item.remindOffset || 0)) ? String(item.remindOffset || 0) : "custom"
  );
  const [customOffset, setCustomOffset] = useState(item.remindOffset || 0);

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
    const remindOffset = offset === "custom" ? Math.max(0, Number(customOffset) || 0) : Number(offset);
    onSave(item.id, {
      text: trimmed, catId, due, hasTime, vague: due == null && item.vague,
      repeat, remind: due != null && remind, remindOffset, notifiedAt: null,
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
                  <option value="hour">hours</option>
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

        <div className="remindrow">
          <label className="remindrow">
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} disabled={!date} />
            <span>remind me{date ? "" : " (set a due date first)"}</span>
          </label>
          {date && remind && (
            <>
              <select value={offset} onChange={(e) => setOffset(e.target.value)} aria-label="Reminder lead time">
                {OFFSET_PRESETS.map((o) => (
                  <option key={o.v} value={String(o.v)}>{o.label}</option>
                ))}
                <option value="custom">custom…</option>
              </select>
              {offset === "custom" && (
                <label className="remindrow">
                  <input
                    type="number" min="0" value={customOffset}
                    onChange={(e) => setCustomOffset(e.target.value)}
                    style={{ width: 72 }} aria-label="Custom lead time in minutes"
                  />
                  <span>min before</span>
                </label>
              )}
            </>
          )}
        </div>

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
