import { dueLabel } from "../lib/dates.js";

// deterministic tiny tilt per item, like cards dropped into a tray
function tilt(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ((h % 5) - 2) * 0.35 + "deg";
}

export default function ItemCard({ item, categories, onToggleDone, onRefile, onRemove }) {
  const label = dueLabel(item);
  const overdue = !item.done && item.due != null && item.due < Date.now();
  return (
    <article className={"card" + (item.done ? " done" : "")} style={{ "--tilt": tilt(item.id) }}>
      <div className="card-row">
        <button className="check" onClick={() => onToggleDone(item.id)} aria-label={item.done ? "Mark not done" : "Mark done"}>
          {item.done ? "■" : "□"}
        </button>
        <p>{item.text}</p>
        {label && <span className={"duechip" + (overdue ? " over" : "") + (item.vague ? " vague" : "")}>{label}</span>}
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
