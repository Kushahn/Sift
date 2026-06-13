import { useState } from "react";
import ItemCard from "./ItemCard.jsx";

export default function Tray({ cat, items, categories, canDelete, onRename, onDelete, onToggleDone, onRefile, onRemove }) {
  const [editName, setEditName] = useState(null);

  function commitRename() {
    const name = (editName || "").trim();
    if (name) onRename(cat.id, name);
    setEditName(null);
  }

  return (
    <section className="tray" style={{ "--c": cat.color }}>
      <header className="tray-head">
        <span className="drum" aria-hidden="true" />
        {editName !== null ? (
          <input
            autoFocus
            className="rename"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditName(null);
            }}
            onBlur={commitRename}
            aria-label="Rename tray"
          />
        ) : (
          <button className="tray-name" onClick={() => setEditName(cat.name)} title="Rename">
            {cat.name}
          </button>
        )}
        <span className="count">{items.length}</span>
        {canDelete && (
          <button className="x" onClick={() => onDelete(cat.id)} aria-label={`Delete tray ${cat.name}`}>×</button>
        )}
      </header>

      {items.length === 0 && <div className="empty">empty — type above</div>}

      {items.map((it) => (
        <ItemCard key={it.id} item={it} categories={categories}
          onToggleDone={onToggleDone} onRefile={onRefile} onRemove={onRemove} />
      ))}
    </section>
  );
}
