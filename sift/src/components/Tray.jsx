import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import ItemCard from "./ItemCard.jsx";
import { inkFor } from "../lib/store.js";

export default function Tray({ cat, items, categories, canDelete, onRename, onDelete, onToggleCollapse, onToggleDone, onRefile, onRemove, onEdit, theme }) {
  const { isOver, setNodeRef } = useDroppable({ id: "tray:" + cat.id });
  const [editName, setEditName] = useState(null);
  const collapsed = !!cat.collapsed;

  function commitRename() {
    const name = (editName || "").trim();
    if (name) onRename(cat.id, name);
    setEditName(null);
  }

  return (
    <section
      ref={setNodeRef}
      className={"tray" + (isOver ? " over" : "") + (collapsed ? " collapsed" : "")}
      style={{ "--c": inkFor(cat.color, theme) }}
    >
      <header className="tray-head">
        <button
          className="fold"
          onClick={() => onToggleCollapse(cat.id)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${cat.name}` : `Collapse ${cat.name}`}
        >
          {collapsed ? "▶" : "▼"}
        </button>
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

      {!collapsed && items.length === 0 && <div className="empty">empty — type above</div>}

      {!collapsed &&
        items.map((it) => (
          <ItemCard key={it.id} item={it} categories={categories}
            onToggleDone={onToggleDone} onRefile={onRefile} onRemove={onRemove} onEdit={onEdit} />
        ))}
    </section>
  );
}
