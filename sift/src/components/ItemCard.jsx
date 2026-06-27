import { useDraggable } from "@dnd-kit/core";
import { dueLabel, repeatLabel } from "../lib/dates.js";

export default function ItemCard({ item, categories, onToggleDone, onRefile, onRemove, onEdit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const label = dueLabel(item);
  const overdue = !item.done && item.due != null && item.due < Date.now();
  return (
    <article
      ref={setNodeRef}
      className={"card" + (item.done ? " done" : "") + (isDragging ? " dragging" : "")}
    >
      <button className="check" onClick={() => onToggleDone(item.id)} aria-label={item.done ? "Mark not done" : "Mark done"}>
        {item.done ? "■" : "□"}
      </button>
      <button className="cardtext" {...attributes} {...listeners} onClick={() => onEdit(item.id)} title="Edit / drag to move">
        {item.text}
      </button>
      {label && <span className={"duechip" + (overdue ? " over" : "") + (item.vague ? " vague" : "")}>{label}</span>}
      {item.repeat && <span className="repglyph">{repeatLabel(item.repeat)}</span>}
      <span className="acts">
        <select value={item.catId} onChange={(e) => onRefile(item.id, e.target.value)} aria-label="Move item" title="Move">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="x" onClick={() => onRemove(item.id)} aria-label="Delete item">×</button>
      </span>
    </article>
  );
}
